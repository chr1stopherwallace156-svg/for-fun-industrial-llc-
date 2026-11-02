import numpy as np

class VectorTopology:
    """Exact cosine search baseline and exact k-nearest-neighbour graph."""
    def __init__(self,dimension,max_vectors=10000):
        if not isinstance(dimension,int) or not 1<=dimension<=8192: raise ValueError("invalid dimension")
        self.dimension=dimension; self.max_vectors=max_vectors; self._vectors={}
    def add(self,vector_id,vector):
        x=np.asarray(vector,dtype=float)
        if not isinstance(vector_id,str) or not vector_id or len(vector_id)>128 or x.shape!=(self.dimension,) or not np.isfinite(x).all(): raise ValueError("invalid vector id or vector")
        if vector_id not in self._vectors and len(self._vectors)>=self.max_vectors: raise ValueError("capacity reached")
        self._vectors[vector_id]=x.copy(); return {"id":vector_id,"count":len(self._vectors)}
    def search(self,query,k=5):
        q=np.asarray(query,dtype=float)
        if q.shape!=(self.dimension,) or not np.isfinite(q).all() or not isinstance(k,int) or not 1<=k<=100: raise ValueError("invalid query or k")
        n=np.linalg.norm(q); out=[]
        for key,v in self._vectors.items():
            d=n*np.linalg.norm(v); out.append({"id":key,"score":float(q@v/d) if d else 0.0})
        return sorted(out,key=lambda r:(-r["score"],r["id"]))[:k]
    def topology(self,neighbours=3):
        if not isinstance(neighbours,int) or not 1<=neighbours<=32: raise ValueError("invalid neighbour count")
        ids=sorted(self._vectors); edges=[]
        for key in ids:
            for item in [r for r in self.search(self._vectors[key],min(len(ids),neighbours+1)) if r["id"]!=key][:neighbours]: edges.append({"source":key,"target":item["id"],"similarity":item["score"]})
        return {"nodes":ids,"edges":edges,"algorithm":"exact-cosine-kNN-topology","approximate":False}
    @property
    def count(self): return len(self._vectors)
