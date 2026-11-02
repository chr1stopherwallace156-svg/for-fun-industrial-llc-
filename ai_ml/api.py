from fastapi import APIRouter,HTTPException
from pydantic import BaseModel,Field
from .hopfield import HopfieldNetwork,modern_hopfield_retrieve
from .multi_universe import MultiUniverseRegistry
from .llama_runtime import LlamaCppRuntime
router=APIRouter(tags=["open-source-ai-ml"])
registry=MultiUniverseRegistry(); memories={}; llama=LlamaCppRuntime()
class Store(BaseModel):
 memory_id:str=Field(min_length=1,max_length=64); units:int=Field(ge=1,le=4096); patterns:list[list[float]]=Field(min_length=1,max_length=256)
class Recall(BaseModel):
 memory_id:str=Field(min_length=1,max_length=64); cue:list[float]; max_sweeps:int=Field(default=20,ge=1,le=1000)
class Modern(BaseModel):
 query:list[float]; patterns:list[list[float]]; beta:float=Field(default=8,gt=0,le=1000)
class Create(BaseModel):
 universe_id:str=Field(min_length=1,max_length=64); vector_dimension:int=Field(ge=1,le=8192); description:str=Field(default="",max_length=256)
class AddVector(BaseModel):
 vector_id:str=Field(min_length=1,max_length=128); vector:list[float]
class Search(BaseModel):
 query:list[float]; k:int=Field(default=5,ge=1,le=100)
class Bridge(BaseModel):
 source:str; target:str
class Transfer(BaseModel):
 source:str; target:str; memory:dict
class State(BaseModel):
 universe_id:str; key:str; values:list[float]
class NeuralTrain(BaseModel):
 features:list[list[float]]=Field(min_length=2,max_length=512); targets:list[list[float]]=Field(min_length=2,max_length=512); hidden_size:int=Field(default=16,ge=1,le=128); epochs:int=Field(default=100,ge=1,le=500); learning_rate:float=Field(default=0.03,gt=0,le=0.2)
class NeuralPredict(BaseModel):
 features:list[list[float]]=Field(min_length=1,max_length=512)
class ChatRequest(BaseModel):
 messages:list[dict]=Field(min_length=1,max_length=24); max_tokens:int=Field(default=512,ge=1,le=1024); temperature:float=Field(default=0.7,ge=0,le=1.2)
def vector_index(universe_id):
    try:return registry._get(universe_id).vectors
    except ValueError as e:raise HTTPException(404,str(e)) from e
def call(fn,*a,**kw):
    try:return fn(*a,**kw)
    except PermissionError as e:raise HTTPException(403,str(e)) from e
    except (ValueError,FileNotFoundError,RuntimeError,TimeoutError) as e:raise HTTPException(422,str(e)) from e
@router.get("/health")
def health():return {"state":"ready","components":["classic-hopfield","modern-hopfield-retrieval","multi-universe-registry","exact-cosine-vector-topology","llama.cpp-chat"],"llama_cpp":llama.status(),"universe_count":len(registry.list())}
@router.post("/hopfield/store")
def store(r:Store):
    if r.memory_id in memories:raise HTTPException(409,"memory id exists")
    n=HopfieldNetwork(r.units); call(n.store,r.patterns); memories[r.memory_id]=n; return {"stored":n.pattern_count,"units":n.units}
@router.post("/hopfield/recall")
def recall(r:Recall):
    if r.memory_id not in memories:raise HTTPException(404,"unknown memory")
    return call(memories[r.memory_id].recall,r.cue,r.max_sweeps)
@router.post("/hopfield/modern-retrieve")
def modern(r:Modern):return call(modern_hopfield_retrieve,r.query,r.patterns,r.beta)
@router.post("/universes")
def create(r:Create):return call(registry.create,r.universe_id,r.vector_dimension,r.description)
@router.get("/universes")
def listing():return {"universes":registry.list()}
@router.get("/universes/{universe_id}")
def describe(universe_id):return call(registry.describe,universe_id)
@router.post("/universes/{universe_id}/vectors")
def add_vector(universe_id,r:AddVector):return call(vector_index(universe_id).add,r.vector_id,r.vector)
@router.post("/universes/{universe_id}/search")
def search(universe_id,r:Search):return {"results":call(vector_index(universe_id).search,r.query,r.k)}
@router.get("/universes/{universe_id}/topology")
def topology(universe_id,neighbours:int=3):return call(vector_index(universe_id).topology,neighbours)
@router.post("/universes/bridges")
def bridge(r:Bridge):return call(registry.add_bridge,r.source,r.target)
@router.post("/universes/transfer")
def transfer(r:Transfer):return call(registry.transfer_memory,r.source,r.target,r.memory)
@router.put("/universes/neural-state")
def neural_state(r:State):return call(registry.set_neural_state,r.universe_id,r.key,r.values)
@router.post("/universes/{universe_id}/neural/train")
def neural_train(universe_id,r:NeuralTrain):return call(registry.train_neural,universe_id,r.features,r.targets,r.hidden_size,r.epochs,r.learning_rate)
@router.post("/universes/{universe_id}/neural/predict")
def neural_predict(universe_id,r:NeuralPredict):return call(registry.predict_neural,universe_id,r.features)
@router.get("/runtime/llama-cpp")
def status():return llama.status()
@router.post("/runtime/llama-cpp/start")
def start_runtime():return call(llama.start_configured)
@router.post("/runtime/llama-cpp/stop")
def stop_runtime():return call(llama.stop)
@router.post("/chat")
def chat(r:ChatRequest):return call(llama.chat,r.messages,r.max_tokens,r.temperature)
