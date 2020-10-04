import glslangModule from "./../../libs/glslang.js";

export async function init(canvas, useWGSL) {
	const adapter = await navigator.gpu.requestAdapter();
	const device = await adapter.requestDevice();
	const glslang = await glslangModule();
	const context = canvas.getContext("gpupresent");

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
		]
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
		passEncoder.draw(3, 1, 0, 0);
		passEncoder.endPass();

		device.defaultQueue.submit([commandEncoder.finish()]);
	}

	return frame;
}

const glslShaders = {
	vertex: `
		#version 450
		const vec2 pos[3] = vec2[3](vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));

		void main() {
			gl_Position = vec4(pos[gl_VertexIndex], 0.0, 1.0);
		}
	`,
	fragment: `
		#version 450
		layout(location = 0) out vec4 outColor;

		void main() {
			outColor = vec4(1.0, 0.0, 0.0, 1.0);
		}
	`
};

const wgslShaders = {
	vertex: `
		var<private> pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
		vec2<f32>(0.0, 0.5),
		vec2<f32>(-0.5, -0.5),
		vec2<f32>(0.5, -0.5));

		[[builtin position]] var<out> Position : vec4<f32>;
		[[builtin vertex_idx]] var<in> VertexIndex : i32;

		fn vtx_main() -> void {
			Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
			return;
		}
		entry_point vertex as "main" = vtx_main;
	`,
	fragment: `
		[[location 0]] var<out> outColor : vec4<f32>;
		fn frag_main() -> void {
			outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
			return;
		}
		entry_point fragment as "main" = frag_main;
	`
};

init(document.getElementById("webgpu-canvas"), false).then((frame) => {
	frame();
});
