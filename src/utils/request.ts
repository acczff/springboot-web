import axios from 'axios';
// 【新增】：引进路由工具，为了后面能把人踢回登录页
import router from '../router';

const request = axios.create({
    // 开发环境用 localhost:8080 直连后端；生产环境用相对路径，由 Nginx 反向代理到后端
    baseURL: import.meta.env.DEV ? 'http://localhost:8080' : '',
    timeout: 5000,
});

request.interceptors.request.use(
    (config) => {
        console.log('🚀 安检员：有一个请求准备发往后厨！目标是：', config.url);
        const token = localStorage.getItem('token');
        if (token) {
            // 真实开发中，我们甚至需要用 encodeURIComponent(token) 来处理含有特殊字符的情况
            // 但现在我们直接传，保证它是标准字符串即可
            config.headers['Authorization'] = `Bearer ${token}`;
            console.log('🎫 安检员：已帮该请求贴上 VIP 身份牌！');
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

request.interceptors.response.use(
    (response) => {
        const res = response.data;

        // 我们后端的逻辑：如果是未登录密码错误等，它可能依然返回 200，但里面的 code 字段是 401 / 404 / 500 等
        if (res.code !== 200) {
            console.error('⚠️ 品控员发现业务错误：', res.message);

            // 【绝杀 1】：根据你自定义的协议，401 是 login 接口的密码错误等，404 是 me 接口的 token 异常等
            // 在这种协议下，只要碰到 404（me 接口异常），说明当前登录状态已失效，我们要清场并踢回登录页
            if (res.code === 404) {
                console.error('🚨 品控员：探测到 404，判定为 me 接口 token 异常，准备清场...');
                localStorage.removeItem('token'); // 没收假工牌
                // 注意这里不用再写 alert 了，因为下面统一会抛出 error 触发页面的 alert
                router.push('/login'); // 踢回登录页
            }

            // 对于 401（login 异常），我们只需要让错误正常抛出到 Login.vue 去提示即可，不需在此清场


            // 不管是 401、404还是500，统统用 Promise.reject 截断，不让它们正常流转到业务代码的 try 块
            return Promise.reject(res.message);
        }

        console.log('✅ 品控员：后厨正常交差了！');
        return res.data;
    },
    (error) => {
        console.log('❌ 品控员大喇叭广播：这个请求后厨没处理成功！错误是：', error);

        // 【绝杀 2】：有些异常不是业务代码返回的 200 包裹的错误，而是真实的 HTTP 401 报错（Spring Boot 框架级别的拦截拦截）
        // 或者像你刚才测试的，因为中文导致 axios 原地爆炸，这里同样能捕获到。

        // 如果出现真实的 HTTP 网络层报错（例如框架强行把错误的 Token 拦截在 404，不进入 Controller）
        // 我们也统一按照咱们的“404等同失效”逻辑处理踢人
        if (error.response && error.response.status === 404) {
            console.error('🚨 真实网络 404 报错：准备清场...');
            localStorage.removeItem('token');
            router.push('/login');
        }

        return Promise.reject(error);
    }
);

export default request;