from dataclasses import dataclass,field
from .vector_topology import VectorTopology

@dataclass
class Universe:
    universe_id:str
    vector_dimension:int
    description:str=""
    vectors:VectorTopology=field(init=False)
    neural_state:dict=field(default_factory=dict)
    memories:list=field(default_factory=list)
    def __post_init__(self): self.vectors=VectorTopology(self.vector_dimension)

class MultiUniverseRegistry:
    """Isolated neural/vector spaces; memory bridges are directed and default-deny."""
    def __init__(self): self._universes={}; self._bridges=set()
    def _get(self,key):
        if key not in self._universes: raise ValueError("unknown universe")
        return self._universes[key]
    def create(self,key,dimension,description=""):
        if not isinstance(key,str) or not key or len(key)>64 or key in self._universes or len(self._universes)>=64: raise ValueError("invalid or duplicate universe id / limit reached")
        self._universes[key]=Universe(key,dimension,description[:256]); return self.describe(key)
    def describe(self,key):
        u=self._get(key); return {"universe_id":key,"vector_dimension":u.vector_dimension,"vector_count":u.vectors.count,"memory_count":len(u.memories),"neural_state_keys":sorted(u.neural_state),"description":u.description}
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
