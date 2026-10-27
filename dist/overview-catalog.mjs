export function overviewWeapons(catalog,team,layout){
 const result={};for(const [group,categories] of [['pistols',['Pistolas']],['mid',['Subfusiles','Pesadas']],['rifles',['Rifles']]]){
 const allowed=catalog.filter(w=>w.teams.includes(team)&&categories.includes(w.category)).map(w=>w.name),order=[...(layout[group]||[]),...allowed];result[group]=[...new Set(order)].filter(w=>allowed.includes(w));
 }result.pistols.sort((a,b)=>Number(['USP-S','P2000','Glock-18'].includes(b))-Number(['USP-S','P2000','Glock-18'].includes(a)));return result;
}
export function overviewAgent(selected,team){return selected||{id:'default-'+team.toLowerCase(),name:team==='CT'?'SAS':'Phoenix Connexion',squad:'Agente predeterminado · '+(team==='CT'?'CT':'TT'),image:'assets/agents/default-'+team.toLowerCase()+'.png',fullImage:'assets/agents/default-'+team.toLowerCase()+'.png',default:true,color:'#8fa9bc',collection:'Aspecto original del juego'}}
