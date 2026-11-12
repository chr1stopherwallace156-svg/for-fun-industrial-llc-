// RAEM-012: AIL API item-metadata compatibility; no HTTP calls and no content retention.
import {createHash} from 'node:crypto';

export const AIL_METADATA_API_PATH='/api/v1/get/item';
export const AIL_SOURCE='AIL Framework (ail-project/ail-framework)';
const types=['infoleak','misp-galaxy','ail','tlp','cve','other'];
const fieldKeys=new Set(['id','date','tags']);
const pathSegment=/^[a-zA-Z0-9_.-]{1,96}$/;
const dateValid=s=>{
  if(typeof s!=='string'||!/^\d{8}$/.test(s))return false;
  const y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8);
  if(y<2000||y>2100||m<1||m>12)return false;
  return d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
};
export function validateAilItemId(id){
  if(typeof id!=='string'||id.length<5||id.length>240||id.includes('\\')||id.startsWith('/'))throw Error('RAEM012_ITEM_ID_INVALID');
  const parts=id.split('/');
  if(parts.length<2||parts.length>12||parts.some(p=>!pathSegment.test(p)||p==='.'||p==='..'))throw Error('RAEM012_ITEM_ID_INVALID');
  return id;
}
// Compatible with documented advanced AIL item lookup, but no caller here performs a request.
// Avoid default/content endpoints because they may return sensitive pasted text.
export function buildAilMetadataRequest(id){
  return Object.freeze({method:'POST',path:AIL_METADATA_API_PATH,
    body:{id:validateAilItemId(id),date:true,tags:true,content:false,size:false,lines:false}});
}
export function normalizeAilMetadata(row){
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!fieldKeys.has(k)))throw Error('RAEM012_METADATA_SCHEMA_INVALID');
  const id=validateAilItemId(row.id);
  if(!dateValid(row.date)||!Array.isArray(row.tags)||row.tags.length>32||row.tags.some(t=>typeof t!=='string'||t.length>160||/[\x00-\x1f\x7f]/.test(t)))throw Error('RAEM012_METADATA_SCHEMA_INVALID');
  const namespaces=Object.fromEntries(types.map(t=>[t,0]));
  for(const tag of row.tags){
    const match=/^([a-z0-9_-]{1,32}):/i.exec(tag);
    const kind=match&&types.includes(match[1].toLowerCase())?match[1].toLowerCase():'other';
    namespaces[kind]++;
  }
  return Object.freeze({fingerprint:createHash('sha256').update('ail-metadata-v1\0'+id+'\0'+row.date).digest('hex'),month:row.date.slice(0,6),tagNamespaces:namespaces,tagCount:row.tags.length});
}
