/* FI_WEB_CHAT_UI_V1 — keep web search in chat; hide duplicate search-only panels/tabs.
 * External same-origin script works with the dashboard's CSP; never deletes nodes.
 */
(()=>{
"use strict";
const TITLES=/^(?:source\s*(?:and|&)\s*explore\s*(?:the\s*)?web|source\s*(?:and|&)\s*explore|explore\s*(?:the\s*)?web|web\s*(?:search|research)\s*(?:workspace|page|panel)?)$/i;
function hideStandaloneSearch(){
 for(const heading of document.querySelectorAll("h1,h2,h3,h4,[role=heading],a,button,[role=tab]")){
  const name=(heading.textContent||"").replace(/\s+/g," ").trim();
  if(!TITLES.test(name))continue;
  if(heading.closest("#chat-history,#chat-proposals,#fi-optimization,#fi-opt-agent"))continue;
  let target=heading.matches("a,button,[role=tab]")?
   heading.closest("li,[role=tab],.nav-item")||heading:
   heading.closest("section,article,.panel,[role=tabpanel]")||heading;
  if(target.querySelector?.("#chat-input,#chat-send,#activate,#fi-optimization,#fi-opt-agent"))continue;
  target.hidden=true;
  target.style.setProperty("display","none","important");
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",hideStandaloneSearch,{once:true});
else hideStandaloneSearch();
const observer=new MutationObserver(hideStandaloneSearch);
observer.observe(document.body,{childList:true,subtree:true});
})();
