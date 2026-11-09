# Pure, side-effect-free classification of a snapshot of port 8443 listeners.
# Never changes any process, credential, firewall, NetBird state, or port.
function Get-FunPrivateGatewayPortState {
 [CmdletBinding()]
 param(
  [AllowEmptyCollection()][object[]]$Listeners=@(),
  [Parameter(Mandatory=$true)][string]$ExpectedIp
 )
 $items=@($Listeners | Where-Object { $null -ne $_ })
 if($items.Count -eq 0){
  return [pscustomobject]@{State="stopped";Count=0;ListenerProcessId=0}
 }
 if($items.Count -ne 1){
  return [pscustomobject]@{State="conflict";Count=$items.Count;ListenerProcessId=0}
 }
 $entry=$items[0]
 try {
  $port=[int]$entry.LocalPort
  $owner=[int]$entry.OwningProcess
  $address=[string]$entry.LocalAddress
  $status=[string]$entry.State
  if($port -ne 8443 -or $address -cne $ExpectedIp -or $owner -le 0 -or
     ($status -and $status -ne "Listen")){
   return [pscustomobject]@{State="conflict";Count=1;ListenerProcessId=0}
  }
  return [pscustomobject]@{State="existing";Count=1;ListenerProcessId=$owner}
 }catch{
  return [pscustomobject]@{State="conflict";Count=1;ListenerProcessId=0}
 }
}
