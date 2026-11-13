(function(root){'use strict';
const material='/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/MI_SpatialFlow_V2_1';
const base=typeof module==='object'&&module.exports?require('./dynamic-lines.js'):root.DTSDynamicLines;
function bounded(v,name,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(name+' is out of range');return v;}
const fract=x=>x-Math.floor(x),hash=x=>fract(Math.sin(x*127.1+91.7)*43758.5453);
function prepareMesh({id,coordinates,color='#24c9ff',width=10,density=1.6,sparkScale=1.8,trail=.4,speed=.34,spacingMeters=12,brightness=2.4,reverse=false,groupId=''}={}){
 const route=base.preparePolyline({id,coordinates,color,width,speed,spacingMeters,brightness,reverse}).coordinates;
 bounded(density,'density',.25,3);bounded(sparkScale,'sparkScale',.5,3);bounded(trail,'trail',.02,1);
 const distances=[0];for(let i=1;i<route.length;i++)distances.push(distances.at(-1)+Math.hypot(...route[i].map((v,k)=>v-route[i-1][k])));
 const length=distances.at(-1),count=Math.ceil(length/6);
 if(count>600)throw Error('Spatial flow supports at most 3600 metres per object; split this route.');
 function at(t){let i=1;while(i<distances.length-1&&distances[i]<t)i++;const f=(t-distances[i-1])/(distances[i]-distances[i-1]);return route[i].map((v,k)=>route[i-1][k]+(v-route[i-1][k])*f);}
 const vertices=[],colors=[],indices=[],faces=[0,2,4,2,1,4,1,3,4,3,0,4,2,0,5,1,2,5,3,1,5,0,3,5];
 let particleCount=0;
 function octa(center,r,axis,stretch,data){const n=vertices.length;const [tx,ty,tz]=axis;const offsets=[[tx*stretch,ty*stretch,tz*stretch],[-tx*stretch,-ty*stretch,-tz*stretch],[-ty*r,tx*r,0],[ty*r,-tx*r,0],[0,0,r],[0,0,-r]];for(const p of offsets){vertices.push(p.map((v,k)=>v+center[k]));colors.push(data.slice());}indices.push(...faces.map(v=>v+n));}
 function sphere(center,r,data){const start=vertices.length,segments=12;vertices.push([center[0],center[1],center[2]+r]);colors.push(data.slice());for(let row=1;row<4;row++){const phi=Math.PI*row/4;for(let col=0;col<segments;col++){const theta=Math.PI*2*col/segments;vertices.push([center[0]+r*Math.sin(phi)*Math.cos(theta),center[1]+r*Math.sin(phi)*Math.sin(theta),center[2]+r*Math.cos(phi)]);colors.push(data.slice());}}const bottom=vertices.length;vertices.push([center[0],center[1],center[2]-r]);colors.push(data.slice());for(let col=0;col<segments;col++){const next=(col+1)%segments;indices.push(start,start+1+col,start+1+next,bottom,start+25+next,start+25+col);for(let row=0;row<2;row++){const a=start+1+row*segments+col,b=start+1+row*segments+next,c=a+segments,d=b+segments;indices.push(a,c,b,b,c,d);}}}
 for(let i=0;i<count;i++){
  const a=at(length*i/count),b=at(length*(i+1)/count),delta=b.map((v,k)=>v-a[k]),len=Math.hypot(...delta),horizontal=Math.hypot(delta[0],delta[1]);
  if(horizontal<.01)throw Error('Spatial flow requires a route with horizontal travel.');
  const axis=delta.map(v=>v/len),angle=fract(Math.atan2(axis[1],axis[0])/(Math.PI*2)),n=Math.max(2,Math.round(len*density*.65));
  for(let j=0;j<n;j++){
   const seed=i*31+j+1,phase=(j+.2+.6*hash(seed))/n,theta=hash(seed+4)*Math.PI*2;
   const lateral=Math.cos(theta)*width*(.07+.14*hash(seed+8));
   const height=1.45+Math.sin(theta)*(.45+.55*hash(seed+12));
   const center=a.map((v,k)=>v+delta[k]*phase);center[0]-=axis[1]*lateral;center[1]+=axis[0]*lateral;center[2]+=height;
   const data=[angle,len/16,phase,(axis[2]+1)/2],r=(.038+.026*hash(seed+16))*sparkScale;
   sphere(center,r,data);
   for(let k=1;k<=2;k++){const distance=trail*k*.55*(reverse?-1:1);const c=center.map((v,d)=>v-axis[d]*distance);octa(c,r*(k===1?.48:.25),axis,r*(k===1?.80:.38),data);}
   particleCount++;
  }
 }
 const rgb=base.preparePolyline({id:'color',coordinates:[[0,0,0],[1,0,0]],color}).vectorParameters[0].value;
 return {id,groupId,coordinateType:0,coordinates:vertices,indices,colors,color:[1,1,1,1],createCollision:false,material,
  scalarParameters:[{name:'MoveSpeed',value:speed*spacingMeters},{name:'MoveDirection',value:reverse?-1:1},{name:'Brightness',value:Math.min(brightness,4)}],
  vectorParameters:[{name:'FlowColor',value:[...rgb.slice(0,3).map(v=>.18+.82*v),1]}],
  userData:JSON.stringify({kind:'spatial-flow',version:'2.0',particleCount,routeLength:length,segments:count,heightRangeMeters:[.35,2.65],real3DGeometry:true,nativeVertexAnimation:true})};
}
const api=Object.freeze({version:'2.0',material,prepareMesh});
if(typeof module==='object'&&module.exports)module.exports=api;else root.DTSSpatialFlow=api;
})(typeof globalThis!=='undefined'?globalThis:this);
