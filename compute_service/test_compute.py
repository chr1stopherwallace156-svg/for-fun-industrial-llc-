from fastapi.testclient import TestClient
from compute_service.app import app
client = TestClient(app)

def test_health_reports_engines():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["graph_engine"] == "networkx"
    assert response.json()["tensor_engine"] == "quimb"

def test_graph_analysis_returns_components_and_centrality():
    response = client.post("/graph/analyze", json={"nodes":["a","b","c","isolated"],"edges":[["a","b"],["b","c"]]})
    assert response.status_code == 200
    body = response.json()
    assert body["nodes"] == 4 and body["edges"] == 2
    assert len(body["components"]) == 2
    assert body["degree_centrality"]["b"] > body["degree_centrality"]["a"]

def test_tensor_network_contracts_matrix_product():
    response = client.post("/tensor/matmul", json={"left":[[1,2],[3,4]],"right":[[5,6],[7,8]]})
    assert response.status_code == 200
    assert response.json()["result"] == [[19.0,22.0],[43.0,50.0]]

def test_tensor_network_rejects_incompatible_shapes():
    response = client.post("/tensor/matmul", json={"left":[[1,2,3]],"right":[[1,2],[3,4]]})
    assert response.status_code == 422

def test_neural_network_train_and_predict():
    features = [[0.0,0.0],[0.0,1.0],[1.0,0.0],[1.0,1.0]]
    targets = [[0.0],[1.0],[1.0],[2.0]]
    trained = client.post("/nn/train",json={"features":features,"targets":targets,"epochs":80})
    assert trained.status_code == 200
    assert trained.json()["device"] == "cpu"
    predicted = client.post("/nn/predict",json={"features":[[0.5,0.5]]})
    assert predicted.status_code == 200
    assert len(predicted.json()["predictions"]) == 1
