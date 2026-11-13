(function(root){'use strict';
const base='/JC_CustomAssets/PolylineLibrary/Exhibition/AIStudio/';
const materials=Object.freeze({particles:base+'MI_ParticleFlow_V2_0',pulse:base+'MI_PulseComposite_V2_0'});
const lines=typeof module==='object'&&module.exports?require('./dynamic-lines.js'):root.DTSDynamicLines;
function bounded(v,name,min,max){if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw Error(name+' is out of range');return v;}
function preparePolyline(options={}){
 const style=options.style??'particles',pulse=style==='pulse';
 const {width=10,spacingMeters=12,speed=pulse?.24:.34,brightness=2.4,density=pulse?1.2:2.0,trail=pulse?.55:.40,spread=.74,sparkScale=pulse?1.8:2.6,pulseSpacingMeters=72,headStrength=1.6,...rest}=options;
 if(!Object.hasOwn(materials,style))throw Error('style must be particles or pulse');
 bounded(density,'density',.25,3);bounded(trail,'trail',.02,1);bounded(spread,'spread',.1,.8);bounded(sparkScale,'sparkScale',.5,3);bounded(headStrength,'headStrength',0,4);bounded(pulseSpacingMeters,'pulseSpacingMeters',spacingMeters,10000);
 const data=lines.preparePolyline({...rest,style:'dash',width,spacingMeters,speed,brightness});
 data.material=materials[style];
 data.scalarParameters.push(...Object.entries({Density:density,Trail:trail,Spread:spread,SparkScale:sparkScale,PulseSpan:pulseSpacingMeters/spacingMeters,HeadStrength:headStrength}).map(([name,value])=>({name,value})));
 data.vectorParameters.push({name:'PulseColor',value:[1,.66,.18,1]});
 return data;
}
const api=Object.freeze({version:'2.0',materials,preparePolyline});
if(typeof module==='object'&&module.exports)module.exports=api;else root.DTSFlowFX=api;
})(typeof globalThis!=='undefined'?globalThis:this);
