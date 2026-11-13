import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import { fileURLToPath, URL } from 'node:url';
import AutoImport from 'unplugin-auto-import/vite'; // 自动导入
import IconsResolver from 'unplugin-icons/resolver'; // icon相关
import Icons from 'unplugin-icons/vite'; // icon相关
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'; // elementPlus
import Components from 'unplugin-vue-components/vite'; // 组件注册
import { defineConfig, loadEnv } from 'vite';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  return {
    base: './',
    plugins: [
      vue(),
      vueJsx(),
      AutoImport({
        // 自动导入的目录（可指定普通类所在的文件夹）
        dirs: [
          'src/utils/**',
          'src/views/dts/**' // 业务类目录
        ],
        imports: ['vue', 'vue-router', 'pinia'],
        resolvers: [
          ElementPlusResolver(),
          // 自动导入图标组件
          IconsResolver({
            prefix: 'Icon'
          })
        ],
        // 生成自动导入的TS声明文件
        dts: "./auto-imports.d.ts",
        // 解决eslint报错问题
        eslintrc: {
          // 这里先设置成true然后npm run dev 运行之后会生成 .eslintrc-auto-import.json 文件之后，在改为false
          enabled: false,
          filepath: './.eslintrc-auto-import.json', // 生成的文件路径
          globalsPropValue: true,
        }
      }),
      Components({
        dirs: ['src/views', 'src/layout', 'src/components', 'src/template'],
        extensions: ['vue'],
        resolvers: [
          ElementPlusResolver(),
          IconsResolver({
            enabledCollections: ['ep'] // 重点
          })
        ],
        dts: './components.d.ts', // 生成类型声明文件，支持 TypeScript 类型提示
        deep: true, // 深度扫描子目录中的组件
        directoryAsNamespace: false, // 是否将目录名作为组件命名空间
      }),
      Icons({
        autoInstall: true
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      }
    },
    css: {
      preprocessorOptions: {
        scss: {
          api: "modern-compiler",
          additionalData: `@use "@/styles/variables.scss" as *;`
        }
      }
    },
    server: {
      open: true, // 是否自动打开浏览器
      host: "0.0.0.0",
      port: 8666, // 端口号
      // 不监听 SVN 元数据：提交时 .svn/tmp 的临时文件被锁，监听会 EBUSY 直接把 dev 服务器带崩
      watch: { ignored: ['**/.svn/**'] },
      proxy: {
        '/admin': {
          target: 'http://www.ab.com',
          changeOrigin: true //          
        },
        '/manage': {
          target: 'http://172.16.190.216:9090',
          changeOrigin: true, //
          rewrite: path => path.replace(/^\/manage/, '/manage'),
        },
        '/finite_element': {
          target: 'http://172.16.190.216:9090',
          changeOrigin: true
        }
      }
    }
  }
})
