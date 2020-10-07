import glslangModule from "./../../libs/glslang.js";

export async function init(canvas, useWGSL) {
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const glslang = await glslangModule();
	const context = canvas.getContext("gpupresent");

	// 顶点位置数据
	const verticesData = new Float32Array([
		0, 0.5,
		-0.5, -0.5,
		0.5, -0.5,
	]);
	const verticesBuffer = device.createBuffer({
		size: verticesData.byteLength,
		usage: GPUBufferUsage.VERTEX,
		mappedAtCreation: true
	});
	new Float32Array(verticesBuffer.getMappedRange()).set(verticesData);
	verticesBuffer.unmap();	

	// 顶点颜色数据rgb
	const colorData = new Float32Array([
		0, 0, 1,
		0, 1, 0,
		1, 0, 0
	]);
	const colorBuffer = device.createBuffer({
		size: colorData.byteLength,
		usage: GPUBufferUsage.VERTEX,
		mappedAtCreation: true
	});
	new Float32Array(colorBuffer.getMappedRange()).set(colorData);
	colorBuffer.unmap();	

	// 设置交换链
	const swapChainFormat = "bgra8unorm";
	const swapChain = context.configureSwapChain({
		device,
		format: swapChainFormat
	});

	const vertexStage = {
		module: useWGSL
			? device.createShaderModule({
				code: wgslShaders.vertex,
			})
			: device.createShaderModule({
				code: glslang.compileGLSL(glslShaders.vertex, "vertex"),
			}),
		entryPoint: "main",
	};

	const fragmentStage = {
		module: useWGSL
			? device.createShaderModule({
				code: wgslShaders.fragment,
			})
			: device.createShaderModule({
				code: glslang.compileGLSL(glslShaders.fragment, "fragment"),
			}),
		entryPoint: "main"
	}

	const pipeline = device.createRenderPipeline({
		vertexStage,
		fragmentStage,
		primitiveTopology: "triangle-list",
		colorStates: [
			{
				format: swapChainFormat
			}
		],
		vertexState: {
			vertexBuffers:[{
				arrayStride: 2 * verticesData.BYTES_PER_ELEMENT,
				attributes:[{
					shaderLocation: 0,
					offset: 0,
					format: "float2"
				}]
			}, {
				arrayStride: 3 * colorData.BYTES_PER_ELEMENT,
				attributes:[{
					shaderLocation: 1,
					offset: 0,
					format: "float3"
				}]
			}]
		}
	});

	function frame() {
		const commandEncoder = device.createCommandEncoder();
		const textureView = swapChain.getCurrentTexture().createView();

		const renderPassDescriptor = {
			colorAttachments: [
				{
					attachment: textureView,
					loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 },
				},
			],
		};

		const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
		passEncoder.setPipeline(pipeline);
		passEncoder.setVertexBuffer(0, verticesBuffer);
		passEncoder.setVertexBuffer(1, colorBuffer);
		passEncoder.draw(3, 1, 0, 0);
		passEncoder.endPass();

		device.defaultQueue.submit([commandEncoder.finish()]);
	}

	return frame;
}

const glslShaders = {
	vertex: `
		#version 450
		layout(location = 0) in vec2 a_position;
		layout(location = 1) in vec3 a_color;

		layout(location = 0) out vec3 fragColor;

		void main() {
			gl_Position = vec4(a_position, 0.0, 1.0);
			fragColor = a_color;
		}
	`,
	fragment: `
		#version 450
		layout(location = 0) in vec3 fragColor;
		layout(location = 0) out vec4 outColor;

		void main() {
			outColor = vec4(fragColor, 1.0);
		}
	`
};

const wgslShaders = {
	vertex: `
		[[builtin(position)]] var<out> out_position : vec4<f32>;
		[[location(0)]] var<out> out_color : vec3<f32>;
		[[location(0)]] var<in> a_position : vec2<f32>;
		[[location(1)]] var<in> a_color : vec3<f32>;
		[[stage(vertex)]]
		fn main() -> void {
			out_position = vec4<f32>(a_position, 0.0, 1.0);
			out_color = a_color;
			return;
		}
	`,
	fragment: `
		[[location(0)]] var<out> fragColor : vec4<f32>;
		[[location(0)]] var<in> in_color : vec3<f32>;
		[[stage(fragment)]]
		fn main() -> void {
			fragColor = vec4<f32>(in_color, 1.0);
			return;
		}
		# sadasdsa
	`
};

init(document.getElementById("webgpu-canvas"), true).then((frame) => {
	frame();
});
