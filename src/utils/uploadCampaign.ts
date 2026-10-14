export function uploadCampaignLabel(filename:string,source:string,slot:'current'|'previous'){
 const clean=filename.replace(/\.xlsx?$/i,'').replace(/[_-]/g,' ').replace(/\s+/g,' ').trim();
 if(source==='senior'){
  const quarter=/(primer|segundo|tercer|cuarto)\s+trimestre/i.exec(clean);
  return quarter?`Senior · ${quarter[1].toLowerCase()} trimestre ${/20\d{2}/.exec(clean)?.[0]??''}`.trim():`Senior ${slot==='current'?'vigente':'anterior'}`;
 }
 if(source==='category'){
  const months=clean.match(/enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre/gi);
  return months?.length?`Catego · ${months.map(m=>m[0].toUpperCase()+m.slice(1).toLowerCase()).join('–')}`:`Catego ${slot==='current'?'vigente':'anterior'}`;
 }
 return clean;
}
// These are publication markers, not commercial-period boundaries.
export function uploadPublicationDates(slot:'current'|'previous',now=new Date()){
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const previous=new Date(Date.parse(day+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 return {start:slot==='current'?day:previous,end:slot==='current'?day:previous,year:day.slice(0,4)};
}
