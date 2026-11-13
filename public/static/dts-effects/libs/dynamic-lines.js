(function(root){'use strict';
const base='/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/';
const materials={dash:base+'MI_FlowDash_V1_2',arrow:base+'MI_ChaseArrow_V1_2'};
function number(value,name,min,max){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(name+' is out of range');return value;}
function rgb(hex){if(!/^#[0-9a-f]{6}$/i.test(hex))throw new Error('color must be #RRGGBB');return [1,3,5].map(i=>{const c=parseInt(hex.slice(i,i+2),16)/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});}
function preparePolyline({id,coordinates,style='dash',groupId='',color='#24c9ff',width=8,spacingMeters=12,speed=.22,brightness=3.8,reverse=false,debugUV=false}={}){
 if(typeof id!=='string'||!id.trim())throw new Error('id is required');
 if(!Object.hasOwn(materials,style))throw new Error('style must be dash or arrow');
 if(typeof reverse!=='boolean'||typeof debugUV!=='boolean')throw new Error('direction and debug flags must be boolean');
 if(!Array.isArray(coordinates)||coordinates.length<2||coordinates.length>10000)throw new Error('coordinates need 2 to 10000 projected points');
 const points=coordinates.map(p=>{if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw new Error('Each point needs finite X,Y,Z in metres');return p.slice();});
 let length=0;
 for(let i=1;i<points.length;i++){const distance=Math.hypot(...points[i].map((v,j)=>v-points[i-1][j]));if(distance<.001)throw new Error('Consecutive points must be distinct');length+=distance;}
 number(width,'width',.05,10000);number(spacingMeters,'spacingMeters',.1,100000);number(speed,'speed',0,100);number(brightness,'brightness',0,20);
 if(length/spacingMeters>100000)throw new Error('Split this route: more than 100000 pattern periods');
 const c=rgb(color);
 return {id,groupId,coordinates:points,coordinateType:0,shape:0,style:0,tiling:0,thickness:width,color:[1,1,1,1],intensity:1,depthTest:true,material:materials[style],scalarParameters:Object.entries({UVAxis:1,Speed:speed,Spacing:spacingMeters/length,PeriodAspect:spacingMeters/width,Direction:reverse?1:-1,Brightness:brightness,DebugUV:debugUV?1:0}).map(([name,value])=>({name,value})),vectorParameters:[{name:'FlowColor',value:[...c,1]},{name:'CoreColor',value:[...c.map(v=>v*.3+.7),1]}]};
}
const api=Object.freeze({version:'1.2',materials:Object.freeze(materials),preparePolyline});
if(typeof module==='object'&&module.exports)module.exports=api;else root.DTSDynamicLines=api;
})(typeof globalThis!=='undefined'?globalThis:this);
