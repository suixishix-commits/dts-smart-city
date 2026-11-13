import { defineStore } from 'pinia';
 const ceshi = defineStore({
  id: 'ceshi',
  state: () => ({
    ceshi: 10,
  }),
  getters: {},
  actions: {
    add(){
      this.ceshi += 1
    },
    add2(){
      this.add()
    }
  }
  
});
export default ceshi;
