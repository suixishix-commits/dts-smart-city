<template>
  <div class="box-scenario">
    <el-popover v-for="(item, index) in typeList" :key="index" class="scenario_popover" placement="bottom" :width="scalePx(400)" trigger="click">
      <template #reference>
        <div class="box">
          <el-tooltip class="box-item" effect="dark" :content="item.name" placement="top">
            <div :class="item.icon"></div>
          </el-tooltip>
        </div>
      </template>
      <div class="parameter__set__box">
        <div v-if="item.name === '环境'">
          <div class="parameter__set__item">
            <div class="set__name">太阳光照强度</div>
            <el-slider
              v-model="weatherStore.sunIntensity.val"
              class="set__progress"
              :step="weatherStore.sunIntensity.step"
              :max="weatherStore.sunIntensity.max"
              @change="weatherStore.setEnvironment('sunIntensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('sunIntensity', undefined, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">月亮光照强度</div>
            <el-slider
              v-model="weatherStore.moonIntensity.val"
              class="set__progress"
              :step="weatherStore.moonIntensity.step"
              :max="weatherStore.moonIntensity.max"
              @change="weatherStore.setEnvironment('moonIntensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('moonIntensity', undefined, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">环境光强度</div>
            <el-slider
              v-model="weatherStore.ambientLightIntensity.val"
              class="set__progress"
              :step="weatherStore.ambientLightIntensity.step"
              :max="weatherStore.ambientLightIntensity.max"
              @change="weatherStore.setEnvironment('ambientLightIntensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('ambientLightIntensity', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">色温</div>
            <el-slider
              v-model="weatherStore.temperature.val"
              class="set__progress"
              :min="weatherStore.temperature.min"
              :step="weatherStore.temperature.step"
              :max="weatherStore.temperature.max"
              @change="weatherStore.setEnvironment('temperature', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('temperature', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">阴影强度</div>
            <el-slider
              v-model="weatherStore.shadowIntensity.val"
              class="set__progress"
              :step="weatherStore.shadowIntensity.step"
              :max="weatherStore.shadowIntensity.max"
              @change="weatherStore.setEnvironment('shadowIntensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('shadowIntensity', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">阴影质量</div>
            <el-slider
              v-model="weatherStore.shadowQuality.val"
              class="set__progress"
              :step="weatherStore.shadowQuality.step"
              :max="weatherStore.shadowQuality.max"
              @change="weatherStore.setEnvironment('shadowQuality', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('shadowQuality', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">阴影可视距离（m）</div>
            <el-slider
              v-model="weatherStore.shadowDistance.val"
              class="set__progress"
              :step="weatherStore.shadowDistance.step"
              :max="weatherStore.shadowDistance.max"
              @change="weatherStore.setEnvironment('shadowDistance', $event)"
            />
            <div class="refresh" @click="weatherStore.setEnvironment('shadowDistance', 0, true)"></div>
          </div>
        </div>
        <div v-if="item.name === '云'">
          <div class="parameter__set__item">
            <div class="set__name">密度</div>
            <el-slider
              v-model="weatherStore.lowCloudDensity.val"
              class="set__progress"
              :step="weatherStore.lowCloudDensity.min"
              :max="weatherStore.lowCloudDensity.max"
              @change="weatherStore.setCloud('lowCloudDensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setCloud('lowCloudDensity', undefined, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">厚度</div>
            <el-slider
              v-model="weatherStore.cloudThickness.val"
              class="set__progress"
              :step="weatherStore.cloudThickness.step"
              :max="weatherStore.cloudThickness.max"
              @change="weatherStore.setCloud('cloudThickness', $event)"
            />
            <div class="refresh" @click="weatherStore.setCloud('cloudThickness', undefined, true)"></div>
          </div>
        </div>
        <div v-if="item.name === '雪'">
          <div class="parameter__set__item">
            <div class="set__name">强度</div>
            <el-slider
              v-model="weatherStore.snowStrength.val"
              class="set__progress"
              :step="weatherStore.snowStrength.step"
              :max="weatherStore.snowStrength.max"
              @change="weatherStore.setSnow('snowStrength', $event)"
            />
            <div class="refresh" @click="weatherStore.setSnow('snowStrength', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">速度</div>
            <el-slider
              v-model="weatherStore.snowSpeed.val"
              class="set__progress"
              :step="weatherStore.snowSpeed.step"
              :max="weatherStore.snowSpeed.max"
              @change="weatherStore.setSnow('snowSpeed', $event)"
            />
            <div class="refresh" @click="weatherStore.setSnow('snowSpeed', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">雪花大小</div>
            <el-slider
              v-model="weatherStore.snowflakeSize.val"
              class="set__progress"
              :step="weatherStore.snowflakeSize.step"
              :max="weatherStore.snowflakeSize.max"
              @change="weatherStore.setSnow('snowflakeSize', $event)"
            />
            <div class="refresh" @click="weatherStore.setSnow('snowflakeSize', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">相机移动对齐</div>
            <el-slider
              v-model="weatherStore.snowAlignCamera.val"
              class="set__progress"
              :step="weatherStore.snowAlignCamera.step"
              :max="weatherStore.snowAlignCamera.max"
              @change="weatherStore.setSnow('snowAlignCamera', $event)"
            />
            <div class="refresh" @click="weatherStore.setSnow('snowAlignCamera', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">阴天程度</div>
            <el-slider
              v-model="weatherStore.snowOvercastStrength.val"
              class="set__progress"
              :step="weatherStore.snowOvercastStrength.step"
              :max="weatherStore.snowOvercastStrength.max"
              @change="weatherStore.setSnow('snowOvercastStrength', $event)"
            />
            <div class="refresh" @click="weatherStore.setSnow('snowOvercastStrength', 0, true)"></div>
          </div>
        </div>
        <div v-if="item.name === '雨'">
          <div class="parameter__set__item">
            <div class="set__name">强度</div>
            <el-slider
              v-model="weatherStore.rainStrength.val"
              class="set__progress"
              :step="weatherStore.rainStrength.step"
              :max="weatherStore.rainStrength.max"
              @change="weatherStore.setRain('rainStrength', $event)"
            />
            <div class="refresh" @click="weatherStore.setRain('rainStrength', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">速度</div>
            <el-slider
              v-model="weatherStore.rainSpeed.val"
              class="set__progress"
              :step="weatherStore.rainSpeed.step"
              :max="weatherStore.rainSpeed.max"
              @change="weatherStore.setRain('rainSpeed', $event)"
            />
            <div class="refresh" @click="weatherStore.setRain('rainSpeed', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">雨滴大小</div>
            <el-slider
              v-model="weatherStore.raindropSize.val"
              class="set__progress"
              :step="weatherStore.raindropSize.step"
              :max="weatherStore.raindropSize.max"
              @change="weatherStore.setRain('raindropSize', $event)"
            />
            <div class="refresh" @click="weatherStore.setRain('raindropSize', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">相机移动对齐</div>
            <el-slider
              v-model="weatherStore.rainAlignCamera.val"
              class="set__progress"
              :step="weatherStore.rainAlignCamera.step"
              :max="weatherStore.rainAlignCamera.max"
              @change="weatherStore.setRain('rainAlignCamera', $event)"
            />
            <div class="refresh" @click="weatherStore.setRain('rainAlignCamera', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">阴天程度</div>
            <el-slider
              v-model="weatherStore.rainOvercastStrength.val"
              class="set__progress"
              :step="weatherStore.rainOvercastStrength.step"
              :max="weatherStore.rainOvercastStrength.max"
              @change="weatherStore.setRain('rainOvercastStrength', $event)"
            />
            <div class="refresh" @click="weatherStore.setRain('rainOvercastStrength', 0, true)"></div>
          </div>
        </div>
        <div v-if="item.name === '雾'">
          <div class="parameter__set__item">
            <div class="set__name">浓度</div>
            <el-slider
              v-model="weatherStore.fogDensity.val"
              class="set__progress"
              :step="weatherStore.fogDensity.step"
              :max="weatherStore.fogDensity.max"
              @change="weatherStore.setFog('fogDensity', $event)"
            />
            <div class="refresh" @click="weatherStore.setFog('fogDensity', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">高度衰减</div>
            <el-slider
              v-model="weatherStore.fogHeightFalloff.val"
              class="set__progress"
              :step="weatherStore.fogHeightFalloff.step"
              :max="weatherStore.fogHeightFalloff.max"
              @change="weatherStore.setFog('fogHeightFalloff', $event)"
            />
            <div class="refresh" @click="weatherStore.setFog('fogHeightFalloff', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">起雾距离</div>
            <el-slider
              v-model="weatherStore.fogStartDistance.val"
              class="set__progress"
              :step="weatherStore.fogStartDistance.step"
              :min="weatherStore.fogStartDistance.min"
              :max="weatherStore.fogStartDistance.max"
              @change="weatherStore.setFog('fogStartDistance', $event)"
            />
            <div class="refresh" @click="weatherStore.setFog('fogStartDistance', 0, true)"></div>
          </div>
          <div class="parameter__set__item">
            <div class="set__name">透明度</div>
            <el-slider
              v-model="weatherStore.fogOpacity.val"
              class="set__progress"
              :step="weatherStore.fogOpacity.step"
              :max="weatherStore.fogOpacity.max"
              @change="weatherStore.setFog('fogOpacity', $event)"
            />
            <div class="refresh" @click="weatherStore.setFog('fogOpacity', 0, true)"></div>
          </div>
        </div>
        <div v-if="item.name === '时间'">
          <div class="parameter__set__item__input">
            <div class="set__name">日夜循环（秒）</div>
            <el-input
              v-model="weatherStore.simulateTime.val"
              class="set__input"
              type="number"
              placeholder="请输入秒数"
              @input="weatherStore.setSimulateTime('simulateTime', $event)"
            ></el-input>
            <div class="refresh" @click="weatherStore.setSimulateTime('simulateTime', 0, true)"></div>
          </div>
          <div class="parameter__set__item__input">
            <div class="set__name">设置时段</div>
            <el-time-select
              v-model="weatherStore.time.val"
              class="set__picker"
              start="06:00"
              step="01:00"
              end="23:00"
              :clearable="false"
              placeholder="请选择时间"
              @change="weatherStore.setDateTime('time', $event)"
            />
            <div class="refresh" @click="weatherStore.setDateTime('time', undefined, true)"></div>
          </div>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script lang="ts" setup>
import { scalePx } from '@/utils/viewportScale'
import { ref, onUnmounted, onMounted, reactive } from 'vue'
import store from '@/stores/index'

// 天气Store
const weatherStore = reactive({ ...store.weatherStore })

// 天气分类设置
const typeList: any = ref([
  {
    name: '云',
    icon: 'yun',
    key: 6
  },
  {
    name: '雾',
    icon: 'wu',
    key: 4
  },
  {
    name: '雨',
    icon: 'yu',
    key: 5
  },
  {
    name: '雪',
    icon: 'xiaoxue',
    key: 3
  },
  {
    name: '环境',
    icon: 'taiyang',
    key: 2
  },
  // {
  // 	name: '雷电',
  // 	icon: 'leidian',
  // 	key: 7
  // },
  {
    name: '时间',
    icon: 'shijian',
    key: 8
  }
])

onMounted(() => {
  console.log('天气设置组件onMounted', weatherStore)
})

onUnmounted(() => {
  // 初始化天气
  //defaultWeather()
})
</script>
<style lang="scss" scoped>
.el-input__inner {
  color: #000;
}
</style>
<style lang="scss">
.el-popover.el-popper {
  padding: 0.03rem !important;
}
.parameter__set__box {
  width: 100%;
  padding: 2rem;
  box-sizing: border-box;
  background: rgb(0, 126, 139, 0.7);
  border-radius: 2px;
  .parameter__set__item {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 1rem 0 1rem 0;
    .set__name {
      display: flex;
      align-items: center;
      width: 15rem;
      font-size: 1.5rem;
      color: #fff;
    }
    .set__progress {
      flex: 1;
      margin-right: 2rem;
    }
    .refresh {
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      background-image: url('./assets/flushed.png');
      background-repeat: no-repeat;
      background-size: 100% 100%;
    }
  }
  .parameter__set__item__input {
    width: 100%;
    display: flex;
    align-items: center;
    padding: 1rem 0 1rem 0;
    .set__name {
      display: flex;
      align-items: center;
      width: 15rem;
      font-size: 1.5rem;
      height: 4rem;
      color: #fff;
    }
    .set__input {
      flex: 1;
      height: 4rem;
      margin-right: 2rem;
    }
    .set__picker {
      flex: 1;
      height: 4rem;
      margin-right: 2rem;
    }
    .refresh {
      cursor: pointer;
      width: 2rem;
      height: 2rem;
      background-image: url('./assets/flushed.png');
      background-repeat: no-repeat;
      background-size: 100% 100%;
    }
  }
}
</style>
<style lang="scss" scoped>
.box-scenario {
  position: absolute;
  pointer-events: all;
  z-index: 999;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  .box {
    display: flex;
    justify-content: space-around;
    align-items: center;
    > div {
      cursor: pointer;
      height: 7rem;
      width: 7rem;
      background-size: 100% 100%;
      background-repeat: no-repeat;
    }
    .yueliang {
      background-image: url('./assets/yueliang.png');
    }
    .taiyang {
      background-image: url('./assets/taiyang.png');
    }
    .xiaoxue {
      background-image: url('./assets/xue.png');
    }
    .wu {
      background-image: url('./assets/wu.png');
    }
    .yu {
      background-image: url('./assets/yu.png');
    }
    .yun {
      background-image: url('./assets/yun.png');
    }
    .leidian {
      background-image: url('./assets/leidian.png');
    }
    .shijian {
      background-image: url('./assets/shijian.png');
    }
  }
}
</style>
