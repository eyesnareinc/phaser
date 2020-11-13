/**
 * @author       Richard Davey <rich@photonstorm.com>
 * @copyright    2020 Photon Storm Ltd.
 * @license      {@link https://opensource.org/licenses/MIT|MIT License}
 */

var AddBlendFS = require('../shaders/AddBlend-frag.js');
var Class = require('../../../utils/Class');
var ColorMatrix = require('../../../display/ColorMatrix');
var ColorMatrixFS = require('../shaders/ColorMatrix-frag.js');
var CopyFS = require('../shaders/Copy-frag.js');
var GetFastValue = require('../../../utils/object/GetFastValue');
var LinearBlendFS = require('../shaders/LinearBlend-frag.js');
var QuadVS = require('../shaders/Quad-vert.js');
var WEBGL_CONST = require('../const');
var WebGLPipeline = require('../WebGLPipeline');

/**
 * @classdesc
 * TODO
 *
 * The fragment shader it uses can be found in `shaders/src/PostFX.frag`.
 * The vertex shader it uses can be found in `shaders/src/PostFX.vert`.
 *
 * The default shader attributes for this pipeline are:
 *
 * `inPosition` (vec2, offset 0)
 * `inTexCoord` (vec2, offset 8)
 *
 * The default shader uniforms for this pipeline are:
 *
 * `uProjectionMatrix` (mat4)
 * `uMainSampler` (sampler2D)
 *
 * @class UtilityPipeline
 * @extends Phaser.Renderer.WebGL.WebGLPipeline
 * @memberof Phaser.Renderer.WebGL.Pipelines
 * @constructor
 * @since 3.50.0
 *
 * @param {Phaser.Types.Renderer.WebGL.WebGLPipelineConfig} config - The configuration options for this pipeline.
 */
var UtilityPipeline = new Class({

    Extends: WebGLPipeline,

    initialize:

    function UtilityPipeline (config)
    {
        config.renderTarget = [
            {
                scale: 1
            },
            {
                scale: 1
            },
            {
                scale: 0.5
            },
            {
                scale: 0.5
            }
        ];
        config.vertShader = QuadVS;
        config.shaders = [
            {
                name: 'Copy',
                fragShader: CopyFS,
                uniforms: [
                    'uMainSampler',
                    'uBrightness'
                ]
            },
            {
                name: 'AddBlend',
                fragShader: AddBlendFS,
                uniforms: [
                    'uMainSampler1',
                    'uMainSampler2',
                    'uStrength'
                ]
            },
            {
                name: 'LinearBlend',
                fragShader: LinearBlendFS,
                uniforms: [
                    'uMainSampler1',
                    'uMainSampler2',
                    'uStrength'
                ]
            },
            {
                name: 'ColorMatrix',
                fragShader: ColorMatrixFS,
                uniforms: [
                    'uMainSampler',
                    'uColorMatrix'
                ]
            }
        ];
        config.attributes = GetFastValue(config, 'attributes', [
            {
                name: 'inPosition',
                size: 2,
                type: WEBGL_CONST.FLOAT
            },
            {
                name: 'inTexCoord',
                size: 2,
                type: WEBGL_CONST.FLOAT
            }
        ]);

        //  x, y, u, v (x/y in NDC)

        config.vertices = new Float32Array([
            -1, -1, 0, 0,
            -1, 1, 0, 1,
            1, 1, 1, 1,
            -1, -1, 0, 0,
            1, 1, 1, 1,
            1, -1, 1, 0
        ]);

        config.batchSize = 1;

        WebGLPipeline.call(this, config);

        this.colorMatrix = new ColorMatrix();

        this.copyShader;
        this.addShader;
        this.linearShader;
        this.colorMatrixShader;

        this.fullFrame1;
        this.fullFrame2;
        this.halfFrame1;
        this.halfFrame2;
    },

    boot: function ()
    {
        WebGLPipeline.prototype.boot.call(this);

        var shaders = this.shaders;
        var targets = this.renderTargets;

        this.copyShader = shaders[0];
        this.addShader = shaders[1];
        this.linearShader = shaders[2];
        this.colorMatrixShader = shaders[3];

        this.fullFrame1 = targets[0];
        this.fullFrame2 = targets[1];
        this.halfFrame1 = targets[2];
        this.halfFrame2 = targets[3];

        console.log(this);
    },

    //  params = RenderTargets
    copyFrame: function (source, target, brightness, clearAlpha)
    {
        if (brightness === undefined) { brightness = 1; }
        if (clearAlpha === undefined) { clearAlpha = true; }

        var gl = this.gl;

        this.set1i('uMainSampler', 0, this.copyShader);
        this.set1f('uBrightness', brightness, this.copyShader);

        if (target)
        {
            gl.viewport(0, 0, target.width, target.height);
        }
        else
        {
            gl.viewport(0, 0, source.width, source.height);
        }

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.fullFrame1.framebuffer);

        if (target)
        {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
        }

        if (clearAlpha)
        {
            gl.clearColor(0, 0, 0, 0);
        }
        else
        {
            gl.clearColor(0, 0, 0, 1);
        }

        gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    },

    drawFrame: function (source, target)
    {
        var gl = this.gl;

        this.set1i('uMainSampler', 0, this.colorMatrixShader);
        this.set1fv('uColorMatrix', this.colorMatrix.getData(), this.colorMatrixShader);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);

        // gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (target)
        {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
        }

        // if (clearAlpha)
        // {
            // gl.clearColor(0, 0, 0, 0);
        // }
        // else
        // {
            // gl.clearColor(0, 0, 0, 1);
        // }

        gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    },

    bindAndDraw: function (source, target)
    {
        var gl = this.gl;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, source.texture);

        // gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (target)
        {
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target.texture, 0);
        }

        // if (clearAlpha)
        // {
            // gl.clearColor(0, 0, 0, 0);
        // }
        // else
        // {
            // gl.clearColor(0, 0, 0, 1);
        // }

        gl.bufferData(gl.ARRAY_BUFFER, this.vertexData, gl.STATIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);
    }

});

module.exports = UtilityPipeline;