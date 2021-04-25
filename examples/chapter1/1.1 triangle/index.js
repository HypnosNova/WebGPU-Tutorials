async function initWebGPU() {
  // 处理初始化的工作
  // 判断浏览器是否支持WebGPU
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

  // 返回设备实例和上下文
  return { device, context };
}

function whatWeDraw(device) {
  // 顶点位置数据
  const triangle = new Float32Array([0, 0, 1, 0, 0, 1]);
  const buffer = device.createBuffer({
    size: triangle.byteLength,
    usage: GPUBufferUsage.VERTEX,
    mappedAtCreation: true,
  });
  new Float32Array(buffer.getMappedRange()).set(triangle);
  buffer.unmap();

  return buffer;
}

function howToDraw(device) {
  const vertex = {
    module: device.createShaderModule({
      code: wgslShaders.vertex,
    }),
    entryPoint: "main",
    buffers: [
      {
        arrayStride: 2 * Float32Array.BYTES_PER_ELEMENT,
        attributes: [
          {
            shaderLocation: 0,
            offset: 0,
            format: "float32x2",
          },
        ],
      },
    ],
  };

  const fragment = {
    module: device.createShaderModule({
      code: wgslShaders.fragment,
    }),
    entryPoint: "main",
    targets: [
      {
        format: "bgra8unorm",
      },
    ],
  };

  return device.createRenderPipeline({
    vertex,
    fragment,
    primitiveTopology: "triangle-list",
  });
}

function draw(device, context, pipeline, buffer) {
  // 设置交换链
  const swapChainFormat = "bgra8unorm";
  const swapChain = context.configureSwapChain({
    device,
    format: swapChainFormat,
  });
  const commandEncoder = device.createCommandEncoder();
  const textureView = swapChain.getCurrentTexture().createView();

  const renderPassDescriptor = {
    colorAttachments: [
      {
        view: textureView,
        loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
      },
    ],
  };

  const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
  passEncoder.setPipeline(pipeline);
  passEncoder.setVertexBuffer(0, buffer);
  passEncoder.draw(3, 1, 0, 0);
  passEncoder.endPass();

  device.queue.submit([commandEncoder.finish()]);
}

initWebGPU().then(({ device, context }) => {
  let buffer = whatWeDraw(device);
  let pipeline = howToDraw(device, context);
  draw(device, context, pipeline, buffer);
});

const wgslShaders = {
  vertex: `
		[[location(0)]] var<in> a_position : vec2<f32>;
		[[stage(vertex)]] fn main() -> [[builtin(position)]] vec4<f32> {
			return vec4<f32>(a_position, 0.0, 1.0);
		}
	`,
  fragment: `
		[[stage(fragment)]] fn main() -> [[location(0)]] vec4<f32> {
			return vec4<f32>(1.0, 0.0, 0.0, 1.0);
		}
	`,
};
