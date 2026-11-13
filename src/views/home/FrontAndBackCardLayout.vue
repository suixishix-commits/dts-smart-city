<template>
  <div class="frontAndBackCardLayout">
    <div class="leftBox">
      <div class="card card1" :class="getClass('left',1)" @click.stop="switchCard('left',getClass('left',1))">
        <slot name="leftCard1"><h1>这是leftCard1(屏幕大于1920px宽度，卡片并列)</h1></slot>
      </div>
      <div class="card card2"  :class="getClass('left',2)" @click.stop="switchCard('left',getClass('left',2))">
        <slot name="leftCard2"><h1>这是leftCard2(屏幕大于1920px宽度，卡片并列)</h1></slot>
      </div>
    </div>
    <div class="rightBox">
      <div class="card card1" :class="getClass('right',1)" @click.stop="switchCard('right',getClass('right',1))">
        <slot name="rightCard1"><h1>这是rightCard1(屏幕大于1920px宽度，卡片并列)</h1></slot>
      </div>
      <div class="card card2"  :class="getClass('right',2)" @click.stop="switchCard('right',getClass('right',2))">
        <slot name="rightCard2"><h1>这是rightCard2(屏幕大于1920px宽度，卡片并列)</h1></slot>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
const props = defineProps({
  //未超出使用宽度卡片，超出宽度
  cardCfg:{
    type:Object,
    default:()=>({
      'notExceededW':'40rem',
      'beyond':'20rem'
    })
  }
})
const switchData = reactive({
  left:true,
  right:false
})
const switchCard = (type:any=null,selectClass:any)=>{
  //点击下层卡片切换
  if (Array.isArray(selectClass) && selectClass.includes('cardFront')) return
  switchData[type] = !switchData[type]
}
const getClass = (type:any=null,num)=>{
  if (switchData[type]) {
    return  num === 1 ? ['cardFront'] : ['cardBack']
  }else {
    return  num === 1 ? ['cardBack'] : ['cardFront']
  }
}
</script>
<style scoped lang="scss">
  .frontAndBackCardLayout {
    pointer-events: all;
    position: fixed;
    top: $titleHeight;
    left: 0;
    width: 100vw;
    height: calc(100vh - $titleHeight);
    .leftBox , .rightBox {
      position:absolute;
      top: 0;
      perspective: 90rem;
      .card {
        height: 100%;
        transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
    }
    .leftBox{
      left: 0;
      height: 100%;
    }
    .rightBox{
      height: 100%;
    }
    .card1{
      background-color: #4285F4;
    }
    .card2{
      background-color: #EA4335;
    }
  }
  //卡片正面样式 <=1920px 卡片切换  >1920px并列显示
@media (max-width: 1920px){
  .card {
    position: absolute;
    top: 0;
    left: 0;
    width: v-bind('cardCfg.notExceededW');
  }
  .leftBox {
    .cardFront {
      transform: translateZ(0) translateX(0); /* Z轴前方 + X轴无位移 */
      opacity: 1;
      z-index: 2;
    }
    .cardBack {
      transform: translateZ(-5rem) translateX(8rem); /* 关键：Z轴后方 + X轴右移 */
      opacity: 0.7;
      z-index: 1;
    }
  }
 .rightBox{
   right:  v-bind('cardCfg.notExceededW');
   .cardFront {
     transform: translateZ(0) translateX(0); /* Z轴前方 + X轴无位移 */
     opacity: 1;
     z-index: 2;
   }
   .cardBack {
     transform: translateZ(-5rem) translateX(-6rem); /* 关键：Z轴后方 + X轴右移 */
     opacity: 0.7;
     z-index: 1;
   }
 }
}
@media (min-width: 1921px) {
  .rightBox{
    right: 0;
  }
  .card{
    width: v-bind('cardCfg.beyond');
  }
  .leftBox , .rightBox{
    display: flex;
  }
}  
</style>