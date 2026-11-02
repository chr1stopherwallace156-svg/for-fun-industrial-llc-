import numpy as np

class HopfieldNetwork:
    """Classic bipolar Hopfield network; asynchronous deterministic recall."""
    def __init__(self, units):
        if not isinstance(units,int) or not 1 <= units <= 4096: raise ValueError("units must be in [1,4096]")
        self.units=units; self.weights=np.zeros((units,units),dtype=float); self.pattern_count=0
    def store(self, patterns):
        x=np.asarray(patterns,dtype=float)
        if x.ndim==1: x=x.reshape(1,-1)
        if x.ndim!=2 or x.shape[1]!=self.units or not np.isfinite(x).all() or not np.isin(x,[-1,1]).all(): raise ValueError("patterns must be finite bipolar vectors of configured width")
        self.weights=x.T@x/self.units; np.fill_diagonal(self.weights,0); self.pattern_count=len(x)
        return {"stored":len(x),"units":self.units}
    def energy(self,state):
        x=np.asarray(state,dtype=float)
        if x.shape!=(self.units,) or not np.isfinite(x).all(): raise ValueError("invalid state")
        return float(-0.5*x@self.weights@x)
    def recall(self,cue,max_sweeps=20):
        x=np.asarray(cue,dtype=float).copy()
        if x.shape!=(self.units,) or not np.isin(x,[-1,1]).all(): raise ValueError("cue must be a bipolar vector of configured width")
        if not isinstance(max_sweeps,int) or not 1<=max_sweeps<=1000: raise ValueError("invalid max_sweeps")
        history=[self.energy(x)]; converged=False
        for _ in range(max_sweeps):
            changed=False
            for i in range(self.units):
                a=self.weights[i]@x; y=1.0 if a>0 else (-1.0 if a<0 else x[i])
                if y!=x[i]: x[i]=y; changed=True
            history.append(self.energy(x))
            if not changed: converged=True; break
        return {"pattern":x.astype(int).tolist(),"energy":history[-1],"energy_history":history,"converged":converged}

def modern_hopfield_retrieve(query,patterns,beta=8.0):
    q=np.asarray(query,dtype=float); p=np.asarray(patterns,dtype=float)
    if p.ndim!=2 or q.ndim!=1 or p.shape[1]!=q.size or not p.shape[0]: raise ValueError("dimension mismatch")
    if not np.isfinite(q).all() or not np.isfinite(p).all() or not np.isfinite(beta) or beta<=0: raise ValueError("inputs must be finite and beta positive")
    z=beta*(p@q)/max(1.0,np.sqrt(q.size)); z-=z.max(); w=np.exp(z); w/=w.sum()
    return {"retrieved":(w@p).tolist(),"attention":w.tolist(),"selected_index":int(w.argmax())}
