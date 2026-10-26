export function selectedAgent(equipment,team,mode,catalog){
  const id=equipment.__agent?.[mode];
  return catalog.find(agent=>agent.id===id&&agent.team===team)||null;
}
export function assignAgent(equipment,team,mode,id,catalog){
  if(!['current','desired'].includes(mode))throw Error('Invalid equipment mode');
  if(id!==null&&!catalog.some(agent=>agent.id===id&&agent.team===team))throw Error('Agent does not belong to this team');
  equipment.__agent={...(equipment.__agent||{}),[mode]:id};
}
