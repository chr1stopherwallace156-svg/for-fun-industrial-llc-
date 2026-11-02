from dataclasses import dataclass,field
import numpy as np
import torch
from .vector_topology import VectorTopology

torch.set_num_threads(1)

@dataclass
class Universe:
    universe_id:str
    vector_dimension:int
    description:str=""
    vectors:VectorTopology=field(init=False)
    neural_state:dict=field(default_factory=dict)
    memories:list=field(default_factory=list)
    neural_model:object=None
    neural_input_width:int|None=None
    neural_output_width:int|None=None
    def __post_init__(self): self.vectors=VectorTopology(self.vector_dimension)

class MultiUniverseRegistry:
    """Isolated neural models and vector spaces; memory bridges are directed/default-deny."""
    def __init__(self): self._universes={}; self._bridges=set()
    def _get(self,key):
        if key not in self._universes: raise ValueError("unknown universe")
        return self._universes[key]
    def create(self,key,dimension,description=""):
        if not isinstance(key,str) or not key or len(key)>64 or key in self._universes or len(self._universes)>=64: raise ValueError("invalid or duplicate universe id / limit reached")
        self._universes[key]=Universe(key,dimension,description[:256]); return self.describe(key)
    def describe(self,key):
        u=self._get(key); return {"universe_id":key,"vector_dimension":u.vector_dimension,"vector_count":u.vectors.count,"memory_count":len(u.memories),"neural_state_keys":sorted(u.neural_state),"neural_model_trained":u.neural_model is not None,"neural_input_width":u.neural_input_width,"neural_output_width":u.neural_output_width,"description":u.description}
    def list(self): return [self.describe(k) for k in sorted(self._universes)]
    def add_bridge(self,source,target):
        self._get(source); self._get(target)
        if source==target: raise ValueError("self bridge forbidden")
        self._bridges.add((source,target)); return {"source":source,"target":target,"state":"one-way bridge enabled"}
    def transfer_memory(self,source,target,memory):
        self._get(source); dest=self._get(target)
        if (source,target) not in self._bridges: raise PermissionError("no explicit bridge authorizes transfer")
        if not isinstance(memory,dict) or len(str(memory))>8192: raise ValueError("memory must be a dictionary <=8192 chars")
        dest.memories.append({"source_universe":source,"payload":memory.copy()}); return {"state":"transferred","source":source,"target":target,"memory_count":len(dest.memories)}
    def set_neural_state(self,key,name,values):
        import math
        u=self._get(key)
        if not isinstance(name,str) or not name or len(name)>64 or not isinstance(values,list) or len(values)>100000 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in values): raise ValueError("invalid neural state")
        u.neural_state[name]=[float(v) for v in values]; return {"universe_id":key,"key":name,"length":len(values)}
    def train_neural(self,key,features,targets,hidden_size=16,epochs=100,learning_rate=0.03):
        u=self._get(key); x=np.asarray(features,dtype=np.float32); y=np.asarray(targets,dtype=np.float32)
        if x.ndim!=2 or y.ndim!=2 or len(x)!=len(y) or not 2<=len(x)<=512 or not 1<=x.shape[1]<=64 or not 1<=y.shape[1]<=32: raise ValueError("invalid training matrix dimensions or sample count")
        if not np.isfinite(x).all() or not np.isfinite(y).all(): raise ValueError("training values must be finite")
        if not isinstance(hidden_size,int) or not 1<=hidden_size<=128 or not isinstance(epochs,int) or not 1<=epochs<=500 or not 0<learning_rate<=0.2: raise ValueError("invalid neural training configuration")
        torch.manual_seed(sum(ord(c) for c in key)%2147483647)
        model=torch.nn.Sequential(torch.nn.Linear(x.shape[1],hidden_size),torch.nn.Tanh(),torch.nn.Linear(hidden_size,y.shape[1]))
        optimizer=torch.optim.Adam(model.parameters(),lr=learning_rate); loss_fn=torch.nn.MSELoss(); tx,ty=torch.from_numpy(x),torch.from_numpy(y); loss_value=float("inf")
        model.train()
        for _ in range(epochs):
            optimizer.zero_grad(); loss=loss_fn(model(tx),ty); loss.backward(); optimizer.step(); loss_value=float(loss.detach().item())
        u.neural_model=model; u.neural_input_width=x.shape[1]; u.neural_output_width=y.shape[1]
        return {"universe_id":key,"state":"trained-in-memory","samples":len(x),"input_width":x.shape[1],"output_width":y.shape[1],"hidden_size":hidden_size,"epochs":epochs,"final_loss":loss_value,"device":"cpu"}
    def predict_neural(self,key,features):
        u=self._get(key)
        if u.neural_model is None: raise ValueError("this universe has no trained neural model")
        x=np.asarray(features,dtype=np.float32)
        if x.ndim!=2 or not 1<=len(x)<=512 or x.shape[1]!=u.neural_input_width or not np.isfinite(x).all(): raise ValueError("invalid prediction matrix")
        u.neural_model.eval()
        with torch.inference_mode(): result=u.neural_model(torch.from_numpy(x)).cpu().numpy()
        return {"universe_id":key,"predictions":result.tolist(),"device":"cpu"}
