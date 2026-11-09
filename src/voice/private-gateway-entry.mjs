// Explicit gateway entrypoint: no .env reading, secrets from child-process
// environment only; no logs of credentials, keys or tokens.
import {createGatewayConfig,createGatewayServer} from "./gateway.mjs";
const config=createGatewayConfig(process.env);
const server=await createGatewayServer(config);
server.listen(config.port,config.bindIp,()=>{
 console.log("FI_IPHONE_NETBIRD_GATEWAY=LISTENING URL=https://"+config.publicHost+
 " BACKEND=127.0.0.1:"+config.backendPort+" PEERS="+config.allowed.size);
});
const halt=()=>server.close(()=>process.exit(0));
process.on("SIGINT",halt);
process.on("SIGTERM",halt);
