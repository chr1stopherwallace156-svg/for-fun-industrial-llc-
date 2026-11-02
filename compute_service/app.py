from __future__ import annotations
import math
import asyncio
import os
from typing import List, Tuple
import networkx as nx
import numpy as np
import quimb.tensor as qtn
import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

torch.set_num_threads(1)
torch.manual_seed(17)
app = FastAPI(title="Fun Industrial Compute Service", version="0.2.0")
_model = None
_model_input = None

class GraphRequest(BaseModel):
    nodes: List[str] = Field(default_factory=list, max_length=1000)
    edges: List[Tuple[str, str]] = Field(default_factory=list, max_length=5000)
class TensorRequest(BaseModel):
    left: List[List[float]] = Field(min_length=1, max_length=256)
    right: List[List[float]] = Field(min_length=1, max_length=256)
class TrainRequest(BaseModel):
    features: List[List[float]] = Field(min_length=2, max_length=512)
    targets: List[List[float]] = Field(min_length=2, max_length=512)
    hidden_size: int = Field(default=16, ge=1, le=128)
    epochs: int = Field(default=150, ge=1, le=500)
    learning_rate: float = Field(default=0.03, gt=0.0, le=0.2)
class PredictRequest(BaseModel):
    features: List[List[float]] = Field(min_length=1, max_length=512)
@app.get("/health")
def health():
    return {"state":"running","graph_engine":"networkx","tensor_engine":"quimb","neural_engine":"pytorch-cpu","model_trained":_model is not None}
@app.post("/graph/analyze")
def graph_analyze(request: GraphRequest):
    graph=nx.Graph(); graph.add_nodes_from(request.nodes); graph.add_edges_from(request.edges)
    if graph.number_of_nodes()>1000 or graph.number_of_edges()>5000: raise HTTPException(413,"graph exceeds configured limits")
    components=[sorted(component) for component in nx.connected_components(graph)]; centrality=nx.degree_centrality(graph)
    return {"nodes":graph.number_of_nodes(),"edges":graph.number_of_edges(),"density":nx.density(graph),"components":components,"degree_centrality":dict(sorted(centrality.items())),"is_connected":nx.is_connected(graph) if graph.number_of_nodes() else True}
@app.post("/tensor/matmul")
def tensor_matmul(request: TensorRequest):
    try: left=np.asarray(request.left,dtype=np.float64); right=np.asarray(request.right,dtype=np.float64)
    except (TypeError,ValueError): raise HTTPException(422,"tensor inputs must be rectangular numeric matrices")
    if left.ndim!=2 or right.ndim!=2 or left.shape[1]!=right.shape[0]: raise HTTPException(422,"matrix dimensions are incompatible")
    if not np.isfinite(left).all() or not np.isfinite(right).all(): raise HTTPException(422,"tensor values must be finite")
    if max(left.shape+right.shape)>256: raise HTTPException(413,"tensor dimension exceeds 256")
    a=qtn.Tensor(left,inds=("row","bond"),tags="LEFT"); b=qtn.Tensor(right,inds=("bond","column"),tags="RIGHT")
    result=qtn.TensorNetwork([a,b]).contract(output_inds=("row","column"),optimize="greedy"); data=np.asarray(result.data,dtype=np.float64)
    return {"shape":list(data.shape),"result":data.tolist(),"engine":"quimb-tensor-network","contraction":"shared bond: bond"}
@app.post("/nn/train")
def train_network(request: TrainRequest):
    global _model,_model_input
    try: x=np.asarray(request.features,dtype=np.float32); y=np.asarray(request.targets,dtype=np.float32)
    except (TypeError,ValueError): raise HTTPException(422,"features and targets must be rectangular numeric matrices")
    if x.ndim!=2 or y.ndim!=2 or len(x)!=len(y): raise HTTPException(422,"features and targets must be equally sized matrices")
    if x.shape[1]>64 or y.shape[1]>32: raise HTTPException(413,"feature or target width exceeds configured limits")
    if not np.isfinite(x).all() or not np.isfinite(y).all(): raise HTTPException(422,"training values must be finite")
    torch.manual_seed(17); model=torch.nn.Sequential(torch.nn.Linear(x.shape[1],request.hidden_size),torch.nn.Tanh(),torch.nn.Linear(request.hidden_size,y.shape[1]))
    optimizer=torch.optim.Adam(model.parameters(),lr=request.learning_rate); loss_fn=torch.nn.MSELoss(); tx,ty=torch.from_numpy(x),torch.from_numpy(y)
    loss_value=math.inf; loss_history=[]; model.train()
    for epoch in range(request.epochs):
        optimizer.zero_grad(); prediction=model(tx); loss=loss_fn(prediction,ty); loss.backward(); optimizer.step(); loss_value=float(loss.detach().item())
        if (epoch+1)%max(1,request.epochs//20)==0 or epoch==0 or epoch==request.epochs-1: loss_history.append({"epoch":epoch+1,"loss":loss_value})
    _model,_model_input=model,x.shape[1]
    return {"state":"trained-in-memory","samples":len(x),"input_width":_model_input,"output_width":y.shape[1],"hidden_size":request.hidden_size,"epochs":request.epochs,"final_loss":loss_value,"loss_history":loss_history,"device":"cpu","persistence":"memory-only; model is not saved to disk"}
@app.post("/nn/predict")
def predict(request: PredictRequest):
    if _model is None: raise HTTPException(409,"train a model before requesting predictions")
    try: x=np.asarray(request.features,dtype=np.float32)
    except (TypeError,ValueError): raise HTTPException(422,"prediction features must be rectangular numeric matrices")
    if x.ndim!=2 or x.shape[1]!=_model_input or len(x)>512: raise HTTPException(422,"prediction matrix has an invalid shape")
    if not np.isfinite(x).all(): raise HTTPException(422,"prediction values must be finite")
    _model.eval()
    with torch.inference_mode(): result=_model(torch.from_numpy(x)).cpu().numpy()
    return {"predictions":result.tolist(),"device":"cpu"}

from ai_ml.api import router as ai_ml_router, llama
app.include_router(ai_ml_router,prefix="/ai")
async def _shutdown_process():
    await asyncio.sleep(0.4)
    os._exit(0)
@app.post("/admin/shutdown")
def shutdown_compute(background_tasks: BackgroundTasks):
    llama.stop()
    background_tasks.add_task(_shutdown_process)
    return {"state":"shutting-down","llama_cpp":"stopped"}
