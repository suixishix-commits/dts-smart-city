(function(root){'use strict';
const material='/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/MI_StreamFlow_V4_0';
const base=typeof module==='object'&&module.exports?require('./dynamic-lines.js'):root.DTSDynamicLines;
const TAU=Math.PI*2,fract=x=>x-Math.floor(x),hash=x=>fract(Math.sin(x*127.1+91.7)*43758.5453);
function bounded(v,name,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(name+' is out of range');return v;}
function routeSampler(coordinates){
 const ds=[0];for(let i=1;i<coordinates.length;i++)ds.push(ds.at(-1)+Math.hypot(...coordinates[i].map((v,k)=>v-coordinates[i-1][k])));
 const length=ds.at(-1);
 function at(distance){const d=Math.max(0,Math.min(length,distance));let i=1;while(i<ds.length-1&&ds[i]<d)i++;const f=(d-ds[i-1])/(ds[i]-ds[i-1]);return coordinates[i].map((v,k)=>coordinates[i-1][k]+(v-coordinates[i-1][k])*f);}
 return {length,at};
}
// A stratified disk includes its interior. Radius scales both lateral and vertical offsets.
// Crossed feathered ribbons replace the previous hard cylindrical surfaces.
function makePath(sample,lane,lanes,radius,height){
 const phase=lane*2.39996322973,radial=Math.pow((lane+.35)/lanes,.72)*.94;
 // Wide volumes need a stable frame: local road-corner normals can fold a
 // hundred-metre offset across the entire volume in only a few metres.
 const frameWindow=.2+Math.max(0,radius-2.2)*2;
 return function(s){const p=sample.at(s),a=sample.at(s-frameWindow),b=sample.at(s+frameWindow),len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(len<.00001)throw Error('Stream flow needs horizontal travel.');
  const angle=phase+Math.sin(s*.031+phase)*.20;
  const r=radius*radial*(.94+.06*Math.sin(s*.049+phase));
  const lateral=Math.cos(angle)*r,h=height+Math.sin(angle)*r;
  return [p[0]-(b[1]-a[1])/len*lateral,p[1]+(b[0]-a[0])/len*lateral,p[2]+h];
 };
}
function settings(o){
 const {color='#16acff',speed=.3,spacingMeters=8,brightness=3.2,reverse=false,trail=.7,sparkScale=1,filamentWidth=.018,haloRadius=.48,manualTime=-1,probe=false,probeStation=200}=o;
 const validated=base.preparePolyline({id:'parameters',coordinates:[[0,0,0],[1,0,0]],color,speed,spacingMeters,brightness,reverse});
 bounded(trail,'trail',.02,1);bounded(manualTime,'manualTime',-1,10000);bounded(sparkScale,'sparkScale',.25,4);
 bounded(filamentWidth,'filamentWidth',.002,.2);bounded(haloRadius,'haloRadius',.08,3);bounded(probeStation,'probeStation',0,1200);
 if(typeof probe!=='boolean')throw Error('probe must be boolean');
 return {rgb:validated.vectorParameters[0].value,values:{MoveSpeed:speed*spacingMeters,MoveDirection:reverse?-1:1,Brightness:brightness,Spacing:spacingMeters,TrailLength:.4+trail*2.5,SparkScale:sparkScale,FilamentWidth:filamentWidth,HaloRadius:haloRadius,ManualTime:manualTime,Probe:probe?1:0,ProbeStation:probeStation}};
}
// Preserve projected fullness by scaling detail and adding a bounded number of tracks.
// Do not multiply count by radius squared: a 200 m volume would otherwise need
// thousands of times more geometry. Compensate additive brightness as tracks grow.
function resolveSettings(o={}){
 const {width=6,radius=width*.3,density=2,autoFit=true}=o;
 bounded(radius,'radius',.1,1000);bounded(density,'density',.25,3);
 if(typeof autoFit!=='boolean')throw Error('autoFit must be boolean');
 const {rgb,values}=settings(o),ratio=autoFit?Math.max(1,radius/2.2):1;
 const trackBoost=Math.min(4,Math.pow(ratio,.35)),detailScale=ratio/Math.sqrt(trackBoost),alongScale=Math.min(8,Math.sqrt(ratio));
 values.FilamentWidth*=detailScale;values.HaloRadius*=detailScale;values.SparkScale*=detailScale;
 values.Spacing*=alongScale;values.MoveSpeed*=alongScale;
 values.TrailLength*=Math.min(detailScale,alongScale*2);
 values.Brightness/=trackBoost;
 // Input points describe the bottom of the flow volume, not its centre axis.
 const height=radius;
 const filaments=Math.round(9*Math.sqrt(trackBoost)),sparkTracks=Math.max(5,Math.round(density*12*trackBoost));
 const stepMetres=.45*trackBoost;
 const geometryKey=JSON.stringify([radius,height,filaments,sparkTracks,stepMetres,values.FilamentWidth,values.HaloRadius]);
 return {autoFit,radius,centerHeight:height,coordinateAnchor:'bottom',filaments,sparkTracks,stepMetres,detailScale,alongScale,rgb,values,geometryKey};
}
function prepareMeshes(o={}){
 const {id,coordinates,width=6,groupId=''}=o;
 const route=base.preparePolyline({id,coordinates,width}).coordinates;
 const resolved=resolveSettings(o),{rgb,values,radius,centerHeight,filaments,sparkTracks:sparks,stepMetres}=resolved,sample=routeSampler(route),chunks=Math.ceil(sample.length/24);
 if(chunks>50)throw Error('Stream flow supports up to 1200 metres per batch; split longer routes.');
 const paths=[],baseOptions=Object.fromEntries(['width','radius','density','autoFit','color','speed','spacingMeters','brightness','reverse','trail','sparkScale','filamentWidth','haloRadius','manualTime','probe','probeStation'].filter(k=>o[k]!==undefined).map(k=>[k,o[k]]));
 for(let i=0;i<filaments;i++)paths.push({path:makePath(sample,i,filaments,radius,centerHeight),seed:hash(i+31),filament:1,r:values.FilamentWidth*8});
 for(let i=0;i<sparks;i++)paths.push({path:makePath(sample,i,sparks,radius,centerHeight),seed:hash(i+103),filament:0,r:values.HaloRadius*2.2});
 const result=[];
 for(let chunk=0;chunk<chunks;chunk++){
  const start=sample.length*chunk/chunks,len=sample.length/chunks,steps=Math.ceil(len/stepMetres),vertices=[],colors=[],indices=[];
  for(const track of paths){const offset=vertices.length;
   for(let j=0;j<=steps;j++){
    const s=start+len*j/steps,p=track.path(s),a=track.path(Math.max(0,s-.12)),b=track.path(Math.min(sample.length,s+.12));
    const tangent=b.map((v,k)=>v-a[k]),norm=Math.hypot(...tangent),t=tangent.map(v=>v/norm),horizontal=Math.hypot(t[0],t[1]),n=[-t[1]/horizontal,t[0]/horizontal,0],up=[-t[2]*n[1],t[2]*n[0],horizontal];
    for(let plane=0;plane<3;plane++){const angle=Math.PI*plane/3;
     for(let side=0;side<2;side++){
      vertices.push(p.map((v,d)=>v+(side*2-1)*track.r*(n[d]*Math.cos(angle)+up[d]*Math.sin(angle))));
      // Binary R endpoints and G flags survive colour conversion; alpha is route distance.
      colors.push([side,track.filament,track.seed,j/steps]);
     }
     if(j<steps){const a=offset+j*6+plane*2;indices.push(a,a+1,a+6,a+1,a+7,a+6);}
    }
   }
  }
  result.push({id:id+'_'+chunk,groupId,coordinateType:0,coordinates:vertices,colors,indices,color:[1,1,1,1],createCollision:false,material,
   scalarParameters:Object.entries({...values,ChunkStart:start,ChunkLength:len,RouteLength:sample.length}).map(([name,value])=>({name,value})),
   vectorParameters:[{name:'FlowColor',value:rgb}],
   userData:JSON.stringify({kind:'stream-flow',version:'4.1',coordinateAnchor:'bottom',chunk,chunkStart:start,chunkLength:len,routeLength:sample.length,filaments,sparkTracks:sparks,radius,centerHeight,filamentWidth:values.FilamentWidth,haloRadius:values.HaloRadius,autoFit:resolved.autoFit,geometryKey:resolved.geometryKey,baseOptions,arcInAlpha:true,direction:values.MoveDirection<0?'end-to-start':'start-to-end',geometry:'three crossed soft ribbons per spatial track',real3DGeometry:true})});
 }
 return result;
}
function retune(meshes,o={}){
 return meshes.map(mesh=>{const meta=JSON.parse(mesh.userData.replaceAll('~!@~!@~!@','"'));
  const baseOptions={...meta.baseOptions,...o},resolved=resolveSettings(baseOptions),{rgb,values}=resolved;
  if(meta.geometryKey!==resolved.geometryKey)throw Error('Changing spatial dimensions or track count requires prepareMeshes.');
  return {...mesh,scalarParameters:mesh.scalarParameters.map(p=>({name:p.name,value:values[p.name]??p.value})),vectorParameters:[{name:'FlowColor',value:rgb}],userData:JSON.stringify({...meta,baseOptions,autoFit:resolved.autoFit,direction:values.MoveDirection<0?'end-to-start':'start-to-end'})};
 });
}
const api=Object.freeze({version:'4.1',material,prepareMeshes,retune,routeSampler,resolveSettings});
if(typeof module==='object'&&module.exports)module.exports=api;else root.DTSStreamFlow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
