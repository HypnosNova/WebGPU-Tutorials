(async () => {
    if (!navigator.gpu) {
        alert("WebGPU is not supported/enabled in your browser");
        return;
    }

    // 获取当前计算机/手机的GPU设备，用于绘图
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    // 获取canvas上下文
    const canvas = document.getElementById("webgpu-canvas");
    const context = canvas.getContext("gpupresent");

    console.log(context)

    // 建立着色器模块
    // ....

    // 指定顶点数据
    // ....

    // 建立渲染输出
    // ....

    // 创建渲染管线
    // ....

    // 渲染
    // ....
})();

