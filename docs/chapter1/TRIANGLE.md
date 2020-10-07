# 1.1 画三角形

## 1.1.1 适配器、设备和上下文

目前浏览器对WebGPU的支持还在开发中。目前为止，Chrome Canary版本，Mac上的Safari支持WebGPU（需要在设置中开启相关的实验性功能选项开关）。

与开发WebGL类似，WebGPU绘图需要获取canvas标签的WebGPU上下文，我们先建立一个index.html页面，然后引用render.js文件。我们将采用模块化引入的方式来书写代码：

```html
<!DOCTYPE html>
<html>
<head>
    <title>WebGPU</title>
</head>
<body>
    <canvas id="webgpu-canvas" width="800" height="450"></canvas>
    <script src="render.js" type="module"></script>
</body>
</html>
```

```javascript
(async () => {
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
```

我们来看看代码里面做了什么：

首先我们请求适配器：

```javascript
const adapter = await navigator.gpu.requestAdapter();
```

适配器表示系统上WebGPU的实现。每个适配器都标识硬件加速器（GPU/CPU）的实例以及在该加速器之上的浏览器实现WebGPU的实例。

如果适配器不可用，它将变为无效，且永久无效。适配器上的任何设备以及这些设备所拥有的内部对象也将变为无效。

> 注意：适配器可以是物理显示适配器（GPU），也可以是软件渲染器。返回的适配器可以引用不同的物理适配器，也可以引用同一物理适配器上的不同的浏览器代码路径或系统驱动程序。应用程序可以一次（通过GPUAdapter）保留多个适配器（即使某些适配器无效），其中两个可以引用相同物理配置的不同实例（例如，如果GPU重置或断开并重新连接）。

然后我们通过适配器请求设备：

```javascript
const device = await adapter.requestDevice();
```
设备是适配器的逻辑实例，通过它可以创建内部对象。它可以在多个代理（agent）之间共享。

设备是从设备创建的所有内部对象的专有所有者：丢失设备后，设备和在设备上创建的所有对象（直接，例如createTexture（）或间接，例如createView（））都将变为无效。

> 无效的对象是由多种情况引起的，包括：
* 如果创建对象时出错，则立即无效。例如，如果对象描述符未描述有效对象，或者没有足够的内存来分配资源，则可能会发生这种情况。
* 如果某个对象被明确销毁（例如GPUBuffer.destroy（）），则该对象将无效。
* 如果拥有对象的设备丢失，则该对象无效。

如果上述操作都没有抛出异常，我们就可以获取WebGPU的上下文：

```javascript
const canvas = document.getElementById("webgpu-canvas");
const context = canvas.getContext("gpupresent");
```

## 1.1.2 WebGPU渲染管线简介

![pipeline](./webgl-triangle-pipeline.svg)

WebGPU渲染管线分为8个阶段：

1. 顶点获取，由GPUVertexStateDescriptor控制
2. 顶点着色器 【可编程】
3. 基本组装，由GPUPrimitiveTopology控制
4. 光栅化，由GPURasterizationStateDescriptor控制
5. 片段着色器 【可编程】
6. 模板测试和操作，由GPUDepthStencilStateDescriptor控制
7. 深度测试和写入，由GPUDepthStencilStateDescriptor控制
8. 输出合并，由GPUColorStateDescriptor控制

其中包含两个可编程阶段：类似于WebGL的顶点着色器和片段着色器。WebGPU还增加了对计算着色器的支持，这些着色器存在于渲染管线之外。

> * 顶点着色器负责将输入的顶点数据转化为裁切空间（clip space）
* 片段着色器负责着色每个被三角形覆盖的像素

我们渲染三角形需要配置这样的管线：指定我们的着色器，顶点属性配置等。在WebGPU中，该管线采用具体对象GPURenderPipeline的形式，它指定了管线的不同部分。此管线的组件配置（例如着色器，顶点状态，渲染输出状态等）是固定的，从而使GPU可以更好地优化管线的渲染。

> GPURenderPipeline是一种控制顶点和片段着色器阶段的管线，可以在GPURenderPassEncoder和GPURenderBundleEncoder中使用。

渲染管线输入为：
* 根据给定的GPUPipelineLayout的绑定值
* 由GPUVertexStateDescriptor描述的顶点和索引缓冲区
* 由GPUColorStateDescriptor描述的颜色附件
* 由GPUDepthStencilStateDescriptor描述的深度模板附件【可选】

渲染管线输出为：
* “存储缓冲区”和“只写存储纹理”类型的绑定值
* 由GPUColorStateDescriptor描述的颜色附件
* 由GPUDepthStencilStateDescriptor描述的深度模板附加【可选】

WebGPU的渲染管线与WebGL有相同点，也有不同点：

绑定到相应输入或输出的缓冲区或纹理可以更改。但是，输入和输出的数量及其类型等无法更改，这与WebGL相反。在WebGL中，通过修改全局状态机隐式指定绘图的管线状态，并且可以在两次绘图调用之间的任何时间交换着色器，顶点状态等，这给优化管线带来了挑战。

## 1.1.3 着色器模块

在WebGPU规范中，使用的是WGSL语言。由于该语言源自苹果的Metal，目前只有Safari和最新的Chrome Canary浏览器支持，其他浏览器还在实现中。不支持WGSL浏览器需要使用GLSL语言，将其编译为SPIR-V二进制编码来使用。

> SPIR-V是Khronos公司的Vulkan所使用的着色器中间语言。

目前为止由于兼容性问题，Safari与其他浏览器使用的是2套不同的语言进行开发，在本教程中会同时提供2种语言着色器代码。当WebGPU规范正式发布之后所有浏览器将会都使用WGSL语言作为着色器语言，使用GLSL编译SPIR-V的方式在未来将被废弃。

#### GLSL

顶点着色器：

```glsl
#version 450
const vec2 pos[3] = vec2[3](vec2(0.0, 0.5), vec2(-0.5, -0.5), vec2(0.5, -0.5));

void main() {
    gl_Position = vec4(pos[gl_VertexIndex], 0.0, 1.0);
}
```

片段着色器：

```glsl
#version 450
layout(location = 0) out vec4 outColor;

void main() {
    outColor = vec4(1.0, 0.0, 0.0, 1.0);
}
```

着色器代码很简单，首先WebGPU需要用到的是es4.5版本的GLSL，所以在代码的开头有：#version 450

在顶点着色器里我们定义了一个二维向量数组，代表三角形三个顶点的位置。

在主函数里，我们通过内置变量gl_VertexIndex得到当前顶点的索引，获取其对应的坐标，然后赋值给内置变量gl_Position。

之后GPU将数据进行图元组装然后光栅化。

到了片段着色器，我们定义了outColor作为对外输出的变量，在主函数里设置该变量的颜色。

#### WGSL

顶点着色器：

```wgsl
var<private> pos : array<vec2<f32>, 3> = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.15),
    vec2<f32>(-0.5, -0.5),
    vec2<f32>(0.5, -0.5));

[[builtin position]] var<out> Position : vec4<f32>;
[[builtin vertex_idx]] var<in> VertexIndex : i32;

fn vtx_main() -> void {
    Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
    return;
}
entry_point vertex as "main" = vtx_main;
```

片段着色器：

```wgsl
[[location 0]] var<out> outColor : vec4<f32>;
fn frag_main() -> void {
    outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
    return;
}
entry_point fragment as "main" = frag_main;
```

我们看到WGSL里面的逻辑几乎和GLSL是相同的。

> 有关GLSL和WGSL具体的语法细节后续章节会详细介绍

我们知道一个顶点着色器必须要和一个片段着色器结合之后才能使用。在WebGL里面我们会分别编译两个着色器代码，然后创建program对象将两个着色器结合起来，每个操作都需要调用api做处理非常繁琐。虽然WebGPU也有类似的操作，但是会比WebGL处理起来更简洁直观。

### 创建模块

对于使用WGSL，将着色器代码变成模块操作会非常容易。只需要如下代码：

```javascript
const vertexModule = device.createShaderModule({
    code: vertexCode
});
const vertexStage =  {
    module: vertexModule,
    entryPoint: "main"
};

const fragmentModule = device.createShaderModule({
    code: fragmentCode
});
const fragmentStage =  {
    module: fragmentModule,
    entryPoint: "main"
};
```

而使用GLSL，必须要借助工具将代码转换为SPIR-V。有两种方式可以做：

**方式一**：
1. 先用工具转化代码为SPIR-V二进制编码文件。（工具使用参见附录）
2. 通过fetch得到二进制编码，生成Uint32Array类型数组对象，或者直接将文件二进制编码拷贝进Uint32Array类型数组。
3. 将该类型数组赋值给顶点着色器和片段着色器stage对象的module字段

**方式二**：
1. npm安装glslang模块并引用
2. 在createShaderModule操作的时候调用glslang的api将代码编译为二进制编码赋值给code，代码如下：

```javascript
import glslangModule from 'glslang';

const glslCompiler = await glslangModule();

// ...some code here

const vertexModule = device.createShaderModule({
    code: glslCompiler.compileGLSL(code, 'vertex')
});
const vertexStage =  {
    module: vertexModule,
    entryPoint: "main"
};

const fragmentModule = device.createShaderModule({
    code: glslCompiler.compileGLSL(code, 'fragment')
});
const fragmentStage =  {
    module: fragmentModule,
    entryPoint: "main"
};
```

两种方式都可以正常使用GLSL代码。通常实际开发中，预编译GLSL是更合适的做法，而且引入glslang模块会增加代码提交，在初始化WebGPU编译也会耗费时间。在本教程中考虑到读者更容易理解代码的使用从而大部分情况采用第二种方式。

### 交换链

有了着色器模块，接下来我们想要渲染画面，就需要设置交换链。交换链至少有两个缓冲区。第一个帧缓冲，即屏幕缓冲screenbuffer(有时也称为front buffer)，是呈现到视频卡输出的缓冲。其余的缓冲称为后向缓冲(back buffer)。每次显示一个新帧时，交换链中的第一个backbuffer将取代screenbuffer，这称为“呈现(present)”或"交换(swap)"。可以在前面的屏幕缓冲和其他backbuffer(如果存在的话)上执行各种其他操作。屏幕缓冲可能被简单地覆盖或返回到交换链的后面进行进一步处理。

> 在计算机图形学中，交换链是图形卡和图形API使用的一系列虚拟帧缓冲区，用于稳定帧率和其他一些功能。交换链通常存在于图形内存中，但也可以存在于系统内存中。不使用交换链可能会导致卡顿渲染，但是许多图形API都要求存在和使用它。

我们将创建交换链，并指定应将片段着色器的输出结果写入何处。为了在画布上显示图像，我们需要一个与上下文关联的交换链。交换链将使我们旋转画布上显示图像，渲染到一个缓冲区，该缓冲区在显示另一个缓冲区时不可见（即双缓冲）。我们通过指定所需的图像格式和纹理用法来创建交换链。交换链将为我们创建一个或多个纹理，其大小可以匹配将在其上显示的画布。由于我们将直接渲染到交换链纹理，因此我们指定将它们用作输出附件。

```javascript
const SWAP_CHAIN_FORMAT = "bgra8unorm";
const swapChain = context.configureSwapChain({
    device: device,
    format: SWAP_CHAIN_FORMAT
});
```

## 1.1.4 创建渲染管线

我们写好了着色器代码，配置了交换链，接下来我们需要组装一个完整的渲染管线：

```javascript
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
```

由于我们只画一个三角形，整个管线设置非常简单。将顶点阶段，片段阶段，原始拓扑还有颜色状态设置即可。
顶点阶段和片段阶段决定了着色器的入口。
原始拓扑设为“triangle-list”表示将顶点按照三角形列表方式进行组装图元。在后续章节会介绍不同的拓扑方式绘制的差异。
颜色状态用于描述被写入管线的颜色附件。
管线还有别的参数，在目前画三角形的例子中暂时没有用到，在后续章节会介绍。

## 1.1.5 渲染

万事俱备，只差渲染环节。
对于渲染我们需要创建一个对于渲染通道的描述：

```javascript
const textureView = swapChain.getCurrentTexture().createView();
const renderPassDescriptor = {
    colorAttachments: [
        {
            attachment: textureView,
            loadValue: { r: 0.0, g: 0.0, b: 0.0, a: 1.0 }
        }
    ]
};
```

我们获取交换链里当前纹理并创建视图，目的是为了拿到渲染之后的图像数据最终输出到屏幕。将视图赋给颜色附件的附件字段上。
loadValue此处是一个颜色值，表示的是清除颜色。这个颜色是GPUColor类型，有rgba四个分量，是取值0到1的浮点数。

接下来我们创建编码器，用于将图像最终输出到屏幕：

```javascript
const commandEncoder = device.createCommandEncoder();

const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
passEncoder.setPipeline(pipeline);
passEncoder.draw(3, 1, 0, 0);
passEncoder.endPass();

device.defaultQueue.submit([commandEncoder.finish()]);
```

# 1.2 总结
一切顺利的话，运行之后浏览器上就会画出黑色背景内有个红色的三角形。

![result](./triangle.jpg)

通过整理，完整的代码如下所示：
```javascript
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

    // 创建顶点阶段
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

    // 创建片段阶段
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

    // 拼装管线
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

    // 渲染帧
	function frame() {
		const commandEncoder = device.createCommandEncoder();
		const textureView = swapChain.getCurrentTexture().createView();

        // 创建渲染通道描述
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

		[[builtin(position)]] var<out> Position : vec4<f32>;
		[[builtin(vertex_idx)]] var<in> VertexIndex : i32;
		[[stage(vertex)]]

		fn main() -> void {
			Position = vec4<f32>(pos[VertexIndex], 0.0, 1.0);
			return;
		}
	`,
	fragment: `
		[[location(0)]] var<out> outColor : vec4<f32>;
		[[stage(fragment)]]
		fn main() -> void {
			outColor = vec4<f32>(1.0, 0.0, 0.0, 1.0);
			return;
		}
	`
};

init(document.getElementById("webgpu-canvas"), false).then((frame) => {
	frame();
});

```

回顾一下，我们画一个三角形主要做了如下这些事：
1. 检测WebGPU兼容性
2. 获取当前的适配器与设备
3. 编写顶点着色器和片段着色器模块
4. 设置交换链
5. 拼装渲染管线
6. 创建编码器并渲染

<a href="../examples/chapter1/triangle/index.html" target="_blank">DEMO地址</a>
