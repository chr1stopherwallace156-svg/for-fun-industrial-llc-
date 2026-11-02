import pytest
from fastapi.testclient import TestClient
from compute_service.app import app
from ai_ml.hopfield import HopfieldNetwork,modern_hopfield_retrieve
from ai_ml.multi_universe import MultiUniverseRegistry
from ai_ml.vector_topology import VectorTopology
client=TestClient(app)
def test_classic_hopfield_recall_energy():
 n=HopfieldNetwork(4); n.store([[1,-1,1,-1]]); r=n.recall([1,-1,-1,-1]); assert r["pattern"]==[1,-1,1,-1]; assert all(b<=a for a,b in zip(r["energy_history"],r["energy_history"][1:]))
def test_hopfield_rejects_invalid_patterns():
 with pytest.raises(ValueError):HopfieldNetwork(2).store([[0,1]])
def test_modern_hopfield_selects_closest():
 r=modern_hopfield_retrieve([1.,0.],[[1.,0.],[0.,1.]],20); assert r["selected_index"]==0 and r["attention"][0]>r["attention"][1]
def test_vector_search_and_graph():
 v=VectorTopology(2); v.add("x",[1,0]); v.add("y",[.9,.1]); v.add("z",[0,1]); assert v.search([1,0],2)[0]["id"]=="x"; assert len(v.topology(1)["edges"])==3
def test_universe_isolation_and_bridge():
 r=MultiUniverseRegistry(); r.create("a",2); r.create("b",3); r.set_neural_state("a","w",[1,2]); assert r.describe("b")["neural_state_keys"]==[]
 with pytest.raises(PermissionError):r.transfer_memory("a","b",{"x":1})
 r.add_bridge("a","b"); r.transfer_memory("a","b",{"ok":True}); assert r.describe("b")["memory_count"]==1
 with pytest.raises(PermissionError):r.transfer_memory("b","a",{"x":1})
def test_api_bridge_default_deny():
 client.post("/ai/universes",json={"universe_id":"test-a","vector_dimension":2}); client.post("/ai/universes",json={"universe_id":"test-b","vector_dimension":2})
 r=client.post("/ai/universes/transfer",json={"source":"test-a","target":"test-b","memory":{"x":1}}); assert r.status_code==403
 client.post("/ai/universes/bridges",json={"source":"test-a","target":"test-b"}); assert client.post("/ai/universes/transfer",json={"source":"test-a","target":"test-b","memory":{"x":1}}).status_code==200
def test_llama_adapter_refuses_missing_assets():
 from ai_ml.llama_runtime import LlamaCppRuntime
 with pytest.raises(FileNotFoundError):LlamaCppRuntime().start("no-bin","no-model")

def test_neural_models_train_independently_per_universe():
 r=MultiUniverseRegistry(); r.create("net-a",2); r.create("net-b",2)
 x=[[0.,0.],[0.,1.],[1.,0.],[1.,1.]]; y=[[0.],[1.],[1.],[2.]]
 trained=r.train_neural("net-a",x,y,hidden_size=8,epochs=20)
 assert trained["state"]=="trained-in-memory" and r.describe("net-a")["neural_model_trained"] is True
 assert r.describe("net-b")["neural_model_trained"] is False
 assert len(r.predict_neural("net-a",[[0.5,0.5]])["predictions"])==1
 with pytest.raises(ValueError):r.predict_neural("net-b",[[0.5,0.5]])
