// Utils
class Sizes {
  constructor(canvas) {
    this.canvas = canvas;
    // window.addEventListener('dblclick', this.fullScreen);
    this.setSizes();
    this.getCursorLocation();
  }

  setSizes() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.pixelRatio = Math.min(window.devicePixelRatio, 2);
  }

  resize() {
    this.setSizes();
  }

  fullScreen() {
    if (!document.fullscreenElement) {
      document.querySelector('html').requestFullscreen();
    }
  }

  getCursorLocation() {
    this.mouseLocation = {
      x: 0,
      y: 0,
    };

    window.addEventListener('mousemove', (event) => {
      this.mouseLocation.x = event.clientX / this.width - 0.5 * 2;
      this.mouseLocation.y = -event.clientY / this.height + 1;
    });

    return this.mouseLocation;
  }
}

class Interval {
  constructor() {
    this.start = Date.now();
    this.current = this.start;
    this.delta = 16;
    this.elapse = 8620;
  }

  update() {
    const currentTime = Date.now();
    this.delta = currentTime - this.current;
    this.current = currentTime;
    this.elapse = this.current - this.start;
  }
}

class Tests {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;

    this.active = window.location.hash === '#tests';

    if (this.active) {
      this.gui = new dat.GUI();
      this.stats = new Stats();
      document.body.appendChild(this.stats.dom);
    }

    // Prompting the user to go to the tests after a minute
    if (!this.active) {
      this.activateTests();
    }
  }

  activateTests() {
    window.setTimeout(() => {
      const goTesting = window.confirm("If you feel this could be better, why don't you tweak it?");
      if (goTesting) {
        window.location.href = '#tests';
        window.location.reload();
      }
    }, 20000);
  }
}

// Three.js Configurations
class Camera {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.sizes = this.app.sizes;
    this.tests = this.app.tests;
    this.canvas = this.app.canvas;

    this.setInstance();
    this.setOrbitControls();
  }

  setInstance() {
    this.instanceGroup = new THREE.Group();

    this.instance = new THREE.PerspectiveCamera(45, this.sizes.width / this.sizes.height, 0.01, 30);
    this.instance.position.set(3, 0, -7);
    this.instanceGroup.add(this.instance);
    this.scene.add(this.instanceGroup);
  }

  setOrbitControls() {
    this.controls = new THREE.OrbitControls(this.instance, this.canvas);
    this.controls.enableDamping = true;
    this.controls.enabled = true;

    if (!this.tests.active) {
      this.controls.enablePan = false;
      this.controls.maxDistance = 8;
      this.controls.minDistance = 5;
      this.controls.maxPolarAngle = Math.PI * 0.48;
      this.controls.minPolarAngle = Math.PI * 0.5;
    } else {
    }
  }

  resize() {
    this.instance.aspect = this.sizes.width / this.sizes.height;
    this.instance.updateProjectionMatrix();
  }

  update() {
    this.instanceGroup.position.x +=
      (this.sizes.mouseLocation.x - this.instanceGroup.position.x) * 0.5;
    this.instanceGroup.position.y +=
      (this.sizes.mouseLocation.y - this.instanceGroup.position.y) * 0.5;

    this.controls.update();
  }
}

class Renderer {
  constructor() {
    this.app = new App();
    this.sizes = this.app.sizes;
    this.camera = this.app.camera;
    this.canvas = this.app.canvas;
    this.scene = this.app.scene;

    this.clearColor = 0x0d0c0d; // 0x0d101f;

    this.setInstance();
  }

  setInstance() {
    this.instance = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    // this.instance.outputColorSpace = THREE.SRGBColorSpace;
    // this.instance.toneMapping = THREE.CineonToneMapping;
    // this.instance.toneMappingExposure = 1.75;
    // this.instance.shadowMap.enabled = true;
    // this.instance.shadowMap.type = THREE.PCFSoftShadowMap;
    this.instance.setClearColor(this.clearColor);
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  resize() {
    this.instance.setSize(this.sizes.width, this.sizes.height);
    this.instance.setPixelRatio(this.sizes.pixelRatio);
  }

  update() {
    this.instance.render(this.scene, this.camera.instance);
  }
}

class Postprocessing {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.camera = this.app.camera.instance;
    this.renderer = this.app.renderer;
    this.sizes = this.app.sizes;
    this.tests = this.app.tests;

    this.setDarkness();
    if (this.tests.active) {
      this.setTests();
    }
  }

  setDarkness() {
    this.mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: new THREE.Color('#767a9f') },
          uLightness: { value: 2.87 },
          uContrast: { value: 2.3 },
        },
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec3 newPosition = position;
            newPosition.z = 1.0;
            gl_Position = vec4(newPosition, 1.0);
            vUv = uv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform vec3 uColor;
          uniform float uLightness;
          uniform float uContrast;

          varying vec2 vUv;

          // Based on artsem0214's example at https://www.shadertoy.com/view/Wdlyzj
          #define TAU 6.28318530718

          #define TILING_FACTOR 1.0
          #define MAX_ITER 8
          #define PI 3.1415926535897932384

          float waterHighlight(vec2 p, float time, float foaminess)
          {
            vec2 i = vec2(p);
            float c = 0.0;
            float foaminess_factor = mix(1.0, 6.0, foaminess);
            float inten = .005 * foaminess_factor;

            for (int n = 0; n < MAX_ITER; n++) 
            {
              float t = time * (1.0 - (3.5 / float(n+1)));
              t += (abs(sin(uTime*PI))+uTime*1.2*PI)*0.125;

              i = p + vec2(cos(t - i.x) + sin(t + i.y), sin(t - i.y) + cos(t + i.x));
              c += 1.0/length(vec2(p.x / (sin(i.x+t)),p.y / (cos(i.y+t))));
            }
            c = 0.2 + c / (inten * float(MAX_ITER));
            c = 1.17-pow(c, 1.4);
            c = pow(abs(c), 8.0);
            return c / (foaminess_factor * uContrast);
          }


          void main() {
            float time = uTime * 0.3+23.0;

            vec2 uv = vUv;

            vec2 uv_square = vec2(uv.x, uv.y);
            float dist_center = pow(1.5*length(uv - 0.5), 2.0);

            float foaminess = smoothstep(0.4, 1.8, dist_center);
            float clearness = 0.1 + 0.9*smoothstep(0.1, 0.5, dist_center);

            clearness *= uLightness;

            vec2 p = mod(uv_square*TAU*TILING_FACTOR, TAU)-250.0;

            float c = waterHighlight(p, time, foaminess);

            vec3 water_color = uColor; // vec3(0.0, 0.35, 0.5);
            vec3 color = vec3(c);
            color = clamp(color + water_color, 0.0, 1.0);

            color = mix(water_color, color, clearness);

            float power = 4.;
            color.r = pow(color.r, power);
            color.g = pow(color.g, power);
            color.b = pow(color.b, power);
            color *= 0.4;

            gl_FragColor = vec4(color, 1.0);
          }
        `,
      }),
    );

    //this.mesh.position.set(0,0,2.4)
    this.scene.add(this.mesh);
  }

  setTests() {
    this.tests.background = this.tests.gui.addFolder('Background');

    const params = {
      color: `#${this.mesh.material.uniforms.uColor.value.getHexString()}`,
    };

    this.tests.background
      .addColor(params, 'color')
      .onChange((value) => {
        this.mesh.material.uniforms.uColor.value.set(value);
      })
      .name('Color');

    this.tests.background
      .add(this.mesh.material.uniforms.uLightness, 'value', -10, 10, 0.01)
      .name('Lightness');

    this.tests.background
      .add(this.mesh.material.uniforms.uContrast, 'value', 0, 10, 0.01)
      .name('Contrast');
  }

  update() {
    this.mesh.material.uniforms.uTime.value = this.app.interval.elapse / 1500;
  }
}

// Three.js Environment
class TentaclePath extends THREE.Curve {
  constructor(scale = 1) {
    super();
    this.scale = scale;
  }

  getPoint(t, optionalTarget = new THREE.Vector3()) {
    const tx = 0; // t * 3 - 1.5;
    const ty = t * 2 - 1.5;
    const tz = 0;

    return optionalTarget.set(tx, ty, tz).multiplyScalar(this.scale);
  }
}

class Jellfish {
  constructor() {
    this.app = new App();
    this.tests = this.app.tests;
    this.scene = this.app.scene;
    this.interval = this.app.interval;

    this.colors = {
      baseColor: 0x000000,
      tentacles: 0x1e116e,
      sheenColor: 0x00b6a4,
      emissiveColor: 0x000000,
    };
    this.geoSize = 1;
    this.geoSigments = 64;
    this.uniforms = {
      uTime: { value: 0 },
      uSize: { value: this.geoSize },
      uSigments: { value: this.geoSigments },
      uRandom: { value: Math.random() },
    };

    this.tentaclesCount = 20;

    this.setBody();
    this.setTentacles();
    if (this.tests.active) {
      this.setTests();
    }
  }

  setBody() {
    this.material = new THREE.MeshPhysicalMaterial({
      color: this.colors.baseColor,
      emissive: this.colors.emissiveColor,
      side: THREE.DoubleSide,
      roughness: 0,
      metalness: 0,
      transmission: 0,
      reflectivity: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.2,
      sheen: 1,
      sheenRoughness: 0.2,
      sheenColor: this.colors.sheenColor,
      transparent: true,
      //depthWrite: false,
      alphaTest: 0.01,
    });

    // Shaders Variables
    this.bodyVertPars = /*glsl*/ `
      #include <common>
      uniform float uTime;
      uniform float uSize;
      uniform float uSigments;

      float smoothMod(float axis, float amp, float rad) {
        float top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
        float bottom = pow(sin(PI * (axis / amp)), 2.0) + pow(rad, 2.0);
        float at = atan(top / bottom);
        return amp * (1.0 / 2.0) - (1.0 / PI) * at;
      }

      vec4 permute(vec4 x) {return mod(((x * 34.0) + 1.0) * x, 289.0);}
      vec4 taylorInvSqrt(vec4 r) {return 1.79284291400159 - 0.85373472095314 * r;}
      vec3 fade(vec3 t) {return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);}

      float cnoise(vec3 P) {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod(Pi0, 289.0);
        Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 / 7.0;
        vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 / 7.0;
        vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
        vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
        vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
        vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
        vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
        vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
        vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
        vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
        return 2.2 * n_xyz;
      }

      float distore(vec3 point) {
        point.y = point.y + sin(-1.5 + point.x * point.z * 5.0) * 0.1;

        float strength = distance(point.xy, vec2(0.0, 1.0));
        strength *= distance(point.zy, vec2(0.0, 1.0));
        strength = smoothMod(abs(strength - 2.0 - uTime), 1.0, 0.5);
        strength = 1.0 - strength;
        strength = pow(strength, 2.0) * 2.0;

        strength *= cnoise(vec3(point.xz * 5.0, uTime * PI)) * 0.15 + 0.85;
        strength *= 0.2;

        return strength;
      }

      vec3 animate(vec3 point) {
        point.y += pow(abs(sin(uTime * PI)), 0.7);
        point.xz *= abs(sin(uTime * PI)) * 0.3 + 0.7;
        return point;
      }

      vec3 orthogonal(vec3 v) {
        return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));
      }

      varying float vDistore;
      varying vec3 vPosition;
    `;

    this.bodyVertMain = /* glsl */ `
      vec3 displacedPosition = animate(position + normal * distore(position));

      float offset = uSize / uSigments;
      vec3 tangent = orthogonal(normal);
      vec3 bitangent = normalize(cross(normal, tangent));
      vec3 neighbour1 = position + tangent * offset;
      vec3 neighbour2 = position + bitangent * offset;
      vec3 displacedNeighbour1 = animate(neighbour1 + normal * distore(neighbour1));
      vec3 displacedNeighbour2 = animate(neighbour2 + normal * distore(neighbour2));

      vec3 displacedTangent = displacedNeighbour1 - displacedPosition;
      vec3 displacedBitangent = displacedNeighbour2 - displacedPosition;

      vec3 displacedNormal = normalize(cross(displacedTangent, displacedBitangent));

      vPosition = position;
      vDistore = distore(position);

      #include <uv_vertex>
    `;

    this.bodyVertNormals = /* glsl */ `
      // This is a copy of the defaultnormal_vertex file with only the following line modifyed
      vec3 transformedNormal = displacedNormal;
      #ifdef USE_INSTANCING

      mat3 m = mat3(instanceMatrix);

      transformedNormal /= vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));

      transformedNormal = m * transformedNormal;

      #endif

      transformedNormal = normalMatrix * transformedNormal;

      #ifdef FLIP_SIDED

      transformedNormal = - transformedNormal;

      #endif

      #ifdef USE_TANGENT

      vec3 transformedTangent = (modelViewMatrix * vec4(objectTangent, 0.0)).xyz;

      #ifdef FLIP_SIDED

      transformedTangent = - transformedTangent;

      #endif

      #endif
    `;

    this.bodyFragAlpha = /* glsl */ `
      #include <alphahash_pars_fragment>

      float transparency(vec3 point) {
        float time = uTime;
        vec3 points = point;
        points.y = point.y + sin(time + point.x * point.z * 5.0) * 0.1;

        float strength = distance(points.xy, vec2(0.0, 1.0));
        strength *= distance(points.zy, vec2(0.0, 1.0));
        strength = 1.0 - strength + 0.4;
        strength *= 2.0;
        strength = step(0.5, strength);

        return strength;
      }
    `;

    this.bodyFragPars = /* glsl */ `
      #include <common>
      uniform float uTime;
      varying vec3 vPosition;
      varying float vDistore;
    `;

    this.material.onBeforeCompile = (shader) => {
      // Didn't set shader.uniforms directly!
      shader.uniforms.uTime = this.uniforms.uTime;
      shader.uniforms.uSize = this.uniforms.uSize;
      shader.uniforms.uSigments = this.uniforms.uSigments;

      // Vertex Pars
      shader.vertexShader = shader.vertexShader.replace('#include <common>', this.bodyVertPars);

      // Vertex Main
      shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', this.bodyVertMain);

      // Vertex Normals
      shader.vertexShader = shader.vertexShader.replace(
        '#include <defaultnormal_vertex>',
        this.bodyVertNormals,
      );

      // Vertex Displacement Map
      shader.vertexShader = shader.vertexShader.replace(
        '#include <displacementmap_vertex>',
        `transformed.xyz = displacedPosition;`,
      );

      // Fragment Pars
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', this.bodyFragPars);

      // Alpha
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphahash_pars_fragment>',
        this.bodyFragAlpha,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <alphamap_fragment>',
        `diffuseColor.a = transparency(vPosition);`,
      );

      // Extra sheen
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance + (vec3(0.6, 0.6, 2.9) * pow(vDistore, 2.0));',
      );
    };

    this.geometry = new THREE.SphereGeometry(
      this.geoSize,
      this.geoSigments,
      this.geoSigments,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.6,
    );

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.rotation.set(0, 0, Math.PI / -8);
    this.mesh.position.set(-0.3, -1, 0);
    this.scene.add(this.mesh);
  }

  setTentacles() {
    // Shaders Variables
    this.tentaclesVertPars = /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform float uRandom;
      uniform float uSize;
      uniform float uSigments;

      varying vec3 vPosition;

      float smoothMod(float axis, float amp, float rad) {
        float top = cos(PI * (axis / amp)) * sin(PI * (axis / amp));
        float bottom = pow(sin(PI * (axis / amp)), 2.0) + pow(rad, 2.0);
        float at = atan(top / bottom);
        return amp * (1.0 / 2.0) - (1.0 / PI) * at;
      }

      //	Classic Perlin 3D Noise
      //	by Stefan Gustavson
      //
      vec4 permute(vec4 x) {
        return mod(((x * 34.0) + 1.0) * x, 289.0);
      }
      vec4 taylorInvSqrt(vec4 r) {
        return 1.79284291400159 - 0.85373472095314 * r;
      }
      vec3 fade(vec3 t) {
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      }
      float cnoise(vec3 P) {
        vec3 Pi0 = floor(P); // Integer part for indexing
        vec3 Pi1 = Pi0 + vec3(1.0); // Integer part + 1
        Pi0 = mod(Pi0, 289.0);
        Pi1 = mod(Pi1, 289.0);
        vec3 Pf0 = fract(P); // Fractional part for interpolation
        vec3 Pf1 = Pf0 - vec3(1.0); // Fractional part - 1.0
        vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
        vec4 iy = vec4(Pi0.yy, Pi1.yy);
        vec4 iz0 = Pi0.zzzz;
        vec4 iz1 = Pi1.zzzz;

        vec4 ixy = permute(permute(ix) + iy);
        vec4 ixy0 = permute(ixy + iz0);
        vec4 ixy1 = permute(ixy + iz1);

        vec4 gx0 = ixy0 / 7.0;
        vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
        gx0 = fract(gx0);
        vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
        vec4 sz0 = step(gz0, vec4(0.0));
        gx0 -= sz0 * (step(0.0, gx0) - 0.5);
        gy0 -= sz0 * (step(0.0, gy0) - 0.5);

        vec4 gx1 = ixy1 / 7.0;
        vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
        gx1 = fract(gx1);
        vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
        vec4 sz1 = step(gz1, vec4(0.0));
        gx1 -= sz1 * (step(0.0, gx1) - 0.5);
        gy1 -= sz1 * (step(0.0, gy1) - 0.5);

        vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
        vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
        vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
        vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
        vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
        vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
        vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
        vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);

        vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
        g000 *= norm0.x;
        g010 *= norm0.y;
        g100 *= norm0.z;
        g110 *= norm0.w;
        vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
        g001 *= norm1.x;
        g011 *= norm1.y;
        g101 *= norm1.z;
        g111 *= norm1.w;

        float n000 = dot(g000, Pf0);
        float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
        float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
        float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
        float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
        float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
        float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
        float n111 = dot(g111, Pf1);

        vec3 fade_xyz = fade(Pf0);
        vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
        vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
        float n_xyz = mix(n_yz.x, n_yz.y, fade_xyz.x);
        return 2.2 * n_xyz;
      }

      vec3 distore(vec3 point) {
        vec3 result;
        float noiseIntensity = 0.4;
        float jerkIntensity = 1.5;

        result.x = point.x + cnoise(vec3(uTime + uRandom, point.yz * jerkIntensity)) * noiseIntensity;
        result.z = point.z + cnoise(vec3(point.xy * jerkIntensity, uTime + uRandom * 0.8)) * noiseIntensity;
        result.y = point.y + uRandom * 0.02;

        return result;
      }

      vec3 orthogonal(vec3 v) {
        return normalize(abs(v.x) > abs(v.z) ? vec3(-v.y, v.x, 0.0) : vec3(0.0, -v.z, v.y));
      }
    `;

    this.levelOneTentaclesVertPars = this.tentaclesVertPars.replace(
      /* glsl */ `vec3 distore(vec3 point) {
        vec3 result;
        float noiseIntensity = 0.4;
        float jerkIntensity = 1.5;

        result.x = point.x + cnoise(vec3(uTime + uRandom, point.yz * jerkIntensity)) * noiseIntensity;
        result.z = point.z + cnoise(vec3(point.xy * jerkIntensity, uTime + uRandom * 0.8)) * noiseIntensity;
        result.y = point.y + uRandom * 0.02;

        return result;
      }`,
      /* glsl */ `
        vec3 distore(vec3 point) {
          float strength = smoothMod(point.y + uTime + PI, 1.0, 1.0);
          strength = pow(strength, 3.0) * 2.0;
          strength += (cnoise(point * 5.0 + uTime * uRandom) * uRandom * 0.1);
    
          return vec3(point.x + strength, point.y, point.z);
        }
      `,
    );

    this.tentaclesVertMain = /* glsl */ `
      vec3 displacedPosition = distore(position);

      float offset = uSize / uSigments;
      vec3 tangent = orthogonal(normal);
      vec3 bitangent = normalize(cross(normal, tangent));
      vec3 neighbour1 = position + tangent * offset;
      vec3 neighbour2 = position + bitangent * offset;
      vec3 displacedNeighbour1 = distore(neighbour1);
      vec3 displacedNeighbour2 = distore(neighbour2);

      vec3 displacedTangent = displacedNeighbour1 - displacedPosition;
      vec3 displacedBitangent = displacedNeighbour2 - displacedPosition;

      vec3 displacedNormal = normalize(cross(displacedTangent, displacedBitangent));

      vPosition = position;
      #include <uv_vertex>
    `;

    this.tentaclesVertNormals = /* glsl */ `
      // This is a copy of the defaultnormal_vertex file with only the following line modifyed
      vec3 transformedNormal = displacedNormal;
      #ifdef USE_TANGENT

      vec3 transformedTangent = objectTangent;

      #endif

      #ifdef USE_BATCHING

      mat3 bm = mat3(batchingMatrix);
      transformedNormal /= vec3(dot(bm[0], bm[0]), dot(bm[1], bm[1]), dot(bm[2], bm[2]));
      transformedNormal = bm * transformedNormal;

      #ifdef USE_TANGENT

      transformedTangent = bm * transformedTangent;

      #endif

      #endif

      #ifdef USE_INSTANCING

      mat3 im = mat3(instanceMatrix);
      transformedNormal /= vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2]));
      transformedNormal = im * transformedNormal;

      #ifdef USE_TANGENT

      transformedTangent = im * transformedTangent;

      #endif

      #endif

      transformedNormal = normalMatrix * transformedNormal;

      #ifdef FLIP_SIDED

      transformedNormal = - transformedNormal;

      #endif

      #ifdef USE_TANGENT

      transformedTangent = (modelViewMatrix * vec4(transformedTangent, 0.0)).xyz;

      #ifdef FLIP_SIDED

      transformedTangent = - transformedTangent;

      #endif

      #endif
    `;

    const path = new TentaclePath(2);
    const geometry = new THREE.TubeGeometry(path, 80, 0.01, 8, false);

    this.tentaclesMaterial = new THREE.MeshPhongMaterial({
      color: this.colors.tentacles,
      specular: 0xffffff,
    });

    this.tentacles = new THREE.Group();

    for (let i = 0; i < this.tentaclesCount; i++) {
      const newMat = this.tentaclesMaterial.clone();

      newMat.onBeforeCompile = (shader) => {
        // Didn't set shader.uniforms directly!
        shader.uniforms.uTime = this.uniforms.uTime;
        shader.uniforms.uRandom = { value: Math.random() * 10 };
        shader.uniforms.uSize = this.uniforms.uSize;
        shader.uniforms.uSigments = this.uniforms.uSigments;

        // Vertex Pars
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          this.tentaclesVertPars,
        );

        // Vertex Main
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          this.tentaclesVertMain,
        );

        // Vertex Normals
        shader.vertexShader = shader.vertexShader.replace(
          '#include <defaultnormal_vertex>',
          this.tentaclesVertNormals,
        );

        // Vertex Displacement Map
        shader.vertexShader = shader.vertexShader.replace(
          '#include <displacementmap_vertex>',
          `transformed.xyz = displacedPosition;`,
        );
      };

      const mesh = new THREE.Mesh(geometry, newMat);
      //mesh.position.set(i, 0, 0);
      this.tentacles.add(mesh);
    }

    this.levelOneTentacles = new THREE.Group();
    for (let i = 0; i < 20; i++) {
      const newMat = this.tentaclesMaterial.clone();

      newMat.onBeforeCompile = (shader) => {
        // Didn't set shader.uniforms directly!
        shader.uniforms.uTime = this.uniforms.uTime;
        shader.uniforms.uRandom = { value: Math.random() };
        shader.uniforms.uSize = this.uniforms.uSize;
        shader.uniforms.uSigments = this.uniforms.uSigments;

        // Vertex Pars
        shader.vertexShader = shader.vertexShader.replace(
          '#include <common>',
          this.levelOneTentaclesVertPars,
        );

        // Vertex Main
        shader.vertexShader = shader.vertexShader.replace(
          '#include <uv_vertex>',
          this.tentaclesVertMain,
        );

        // Vertex Normals
        shader.vertexShader = shader.vertexShader.replace(
          '#include <defaultnormal_vertex>',
          this.tentaclesVertNormals,
        );

        // Vertex Displacement Map
        shader.vertexShader = shader.vertexShader.replace(
          '#include <displacementmap_vertex>',
          `transformed.xyz = displacedPosition;`,
        );
      };

      const mesh = new THREE.Mesh(geometry, newMat);
      mesh.position.set(0, 0, 0);
      mesh.rotation.set(0, i, 0);
      this.levelOneTentacles.add(mesh);
    }

    this.tentacles.rotation.z = Math.PI / -8;
    this.levelOneTentacles.rotation.z = Math.PI / -8;

    this.tentaclesGroup = new THREE.Group();
    this.tentaclesGroup.add(this.tentacles, this.levelOneTentacles);

    this.tentaclesGroup.position.set(-0.4, -1.1, 0);

    this.scene.add(this.tentaclesGroup);
  }

  setTests() {
    // this.tests.gui.add(this.uniforms.uDebug, 'value', 0, 1, 0.01);
    this.tests.shader = this.tests.gui.addFolder('Body');

    this.tests.shader.addColor(this.colors, 'baseColor').onChange(() => {
      this.material.color.set(this.colors.baseColor);
    });
    this.tests.shader.add(this.material, 'roughness', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'metalness', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'reflectivity', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'clearcoat', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'clearcoatRoughness', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'sheen', 0, 1, 0.01);
    this.tests.shader.add(this.material, 'sheenRoughness', 0, 1, 0.01);
    this.tests.shader.addColor(this.colors, 'sheenColor').onChange(() => {
      this.material.sheenColor.set(this.colors.sheenColor);
    });
    this.tests.shader.add(this.material, 'transmission', 0, 1, 0.01);
    this.tests.shader.addColor(this.colors, 'emissiveColor').onChange(() => {
      this.material.emissive.set(this.colors.emissiveColor);
    });
  }

  update() {
    const x = this.interval.elapse / 1500;
    this.tentaclesGroup.position.x = (Math.abs(Math.sin(x * Math.PI)) * Math.PI) / 10 - 0.4;
    this.tentaclesGroup.position.y = (Math.abs(Math.sin(x * Math.PI)) * Math.PI) / 5 - 1.1;

    this.uniforms.uTime.value = this.interval.elapse / 1500;
  }
}

class Particles {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.sizes = this.app.sizes;
    this.interval = this.app.interval;

    this.loader = new THREE.TextureLoader();
    this.particlesTexture = this.loader.load('./textures/particles.png');
    this.bubbelsTexture = this.loader.load('./textures/bubbles.png');

    this.setParticles();
  }

  setParticles() {
    // Shaders
    const vertexShader = /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uSize;
      uniform sampler2D uParticlesTexture;

      attribute float aRandom;
      attribute float aScale;

      varying float vRandom;
      varying vec3 vPosition;

      void main() {
        // Animation
        float time = uTime;
        float animation = (abs(sin(time * PI)) + time * 1.2 * PI) / 5.0;

        vec3 newPosition = position;
        float angle = atan(newPosition.z, newPosition.y) + animation;
        newPosition.z = sin(angle);
        newPosition.y = cos(angle);

        newPosition.yz *= 2.0 - aScale * 0.25;
        newPosition.y -= 2.0;

        vec4 mvPosition = modelViewMatrix * vec4(newPosition, 1.0);

        // Position
        gl_Position = projectionMatrix * mvPosition;

        // Points
        gl_PointSize = uSize * uPixelRatio * (1.0 / -mvPosition.z);

        // Varyings
        vPosition = newPosition;
        vRandom = aRandom;
      }
    `;

    const fragmentShader = /* glsl */ `
      #include <common>
      uniform float uTime;
      uniform sampler2D uParticlesTexture;
      uniform sampler2D uBubblesTexture;

      varying float vRandom;
      varying vec3 vPosition;

      // Functions re-declaration
      float worldAlpha(vec3 point);

      void main() {
        // Associating the textures alpha state
        float alpha;
        vec4 particles = texture2D(uParticlesTexture, gl_PointCoord * 2.0 - 0.5);
        vec4 bubbles = texture2D(uBubblesTexture, gl_PointCoord);

        if(vRandom > -3.5) {
          alpha = particles.x;
        } else {
          alpha = bubbles.x;
        }

        //alpha *= worldAlpha(vPosition);

        // Setting colors
        vec4 color = vec4(vec3(worldAlpha(vPosition)), alpha);

        gl_FragColor = color;
      }

      // Functions re-declaration
      float worldAlpha(vec3 point) {
        point = point + 1.0;
        point.z += 0.5;

        float time = uTime;
        float animation = abs(sin(time * PI));
        point.z -= 0.8 - animation;

        float strength = distance(point.xy, vec2(1.0)) / clamp(sin(point.z), 0.0, 1.0) - 0.5;
        //strength *= distance(point.yz, vec2(1.0)) / clamp(sin(point.x), 0.0, 1.0) - 0.5;
        //strength *= distance(point.xz, vec2(1.0)) / clamp(sin(point.y), 0.0, 1.0) - 0.5;
        strength = 1.0 - strength;

        return strength;
      }
    `;

    this.uniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: this.sizes.pixelRatio },
      uSizes: { value: new THREE.Vector2(this.sizes.width, this.sizes.height) },
      uSize: { value: 50.0 },
      uParticlesTexture: { value: this.particlesTexture },
      uBubblesTexture: { value: this.bubbelsTexture },
    };

    // Particles Geometry Settings
    this.particlesInfo = {
      count: 2000,
      scale: 2.5,
      color: 0xffffff,
    };
    this.particlesGeometry = new THREE.BufferGeometry();

    // Filling the geometry with random particles at scale
    // And adding a random attribute
    this.particlesPositions = new Float32Array(this.particlesInfo.count * 3);
    this.randomAttr = new Float32Array(this.particlesInfo.count);
    this.aScale = new Float32Array(this.particlesInfo.count);

    for (let i = 0; i < this.particlesInfo.count; i++) {
      this.particlesPositions[i * 3] = (Math.random() - 0.5) * 2;
      this.particlesPositions[i * 3 + 1] = Math.random() - 0.5;
      this.particlesPositions[i * 3 + 2] = Math.random() - 0.5;

      this.randomAttr[i] = (Math.random() - 0.5) * 10;
      this.aScale[i] = (Math.random() - 0.5) * 10;
    }
    this.particlesGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(this.particlesPositions, 3),
    );
    this.particlesGeometry.setAttribute('aRandom', new THREE.BufferAttribute(this.randomAttr, 1));
    this.particlesGeometry.setAttribute('aScale', new THREE.BufferAttribute(this.aScale, 1));

    // Setting the materials
    this.particlesMaterial = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader,
      fragmentShader,
    });

    // Creating the mesh
    this.particles = new THREE.Points(this.particlesGeometry, this.particlesMaterial);
    this.particles.rotation.reorder('YXZ');
    this.particles.rotation.set(1, -Math.PI * 0.5, 0);
    this.particles.position.set(0.2, 0.5, 0);

    this.scene.add(this.particles);
  }

  update() {
    const x = this.interval.elapse / 1500;
    this.uniforms.uTime.value = x;

    /*
    this.bubbles.rotation.z =
      (Math.abs(Math.sin(x * Math.PI)) + x * 1.2 * Math.PI) / 10;
    this.particles.rotation.z =
      (Math.abs(Math.sin(x * Math.PI)) + x * 1.2 * Math.PI) / 10;
    */
  }
}

class Lights {
  constructor() {
    this.app = new App();
    this.tests = this.app.tests;
    this.scene = this.app.scene;

    this.lightsColor = {
      a: '#7db7ff',
      b: '#ff5aa2',
      ambient: '#ffffff',
    };

    this.AreaLightsEnabled = false;

    //this.ambient = new THREE.AmbientLight(this.lightsColor.ambient, );
    //this.scene.add(this.ambient);

    this.setLightType();

    if (this.tests.active) {
      this.setTests();
    }
  }

  setLightType() {
    if (this.AreaLightsEnabled) {
      //this.setAreaLights();
    } else {
      this.setDirectionalLights();
    }
  }

  setDirectionalLights() {
    this.lightA = new THREE.DirectionalLight(this.lightsColor.a, 10);
    this.lightA.position.set(3.3, 8, -2.6);

    this.lightB = new THREE.DirectionalLight(this.lightsColor.b, 10);
    this.lightB.position.set(-4.8, 10, 10);

    this.scene.add(this.lightA, this.lightB);
  }

  setTests() {
    this.tests.lights = this.tests.gui.addFolder('Lights');

    this.tests.lights
      .addColor(this.lightsColor, 'a')
      .onChange(() => {
        this.lightA.color.set(this.lightsColor.a);
      })
      .name('LightA');
    this.tests.lights.add(this.lightA, 'intensity', 0, 20, 0.001).name('LightAIntensity');
    this.tests.lights.add(this.lightA.position, 'x', -10, 10, 0.1).name('LightAX');
    this.tests.lights.add(this.lightA.position, 'y', -10, 10, 0.1).name('LightAY');
    this.tests.lights.add(this.lightA.position, 'z', -10, 10, 0.1).name('LightAZ');

    this.tests.lights
      .addColor(this.lightsColor, 'b')
      .onChange(() => {
        this.lightB.color.set(this.lightsColor.b);
      })
      .name('LightB');
    this.tests.lights.add(this.lightB, 'intensity', 0, 20, 0.001).name('LightBIntensity');
    this.tests.lights.add(this.lightB.position, 'x', -10, 10, 0.1).name('LightBX');
    this.tests.lights.add(this.lightB.position, 'y', -10, 10, 0.1).name('LightBY');
    this.tests.lights.add(this.lightB.position, 'z', -10, 10, 0.1).name('LightBZ');
  }
}

class World {
  constructor() {
    this.app = new App();
    this.scene = this.app.scene;
    this.renderer = this.app.renderer;
    this.tests = this.app.tests;

    this.jellfish = new Jellfish();
    this.lights = new Lights();
    this.particles = new Particles();
  }

  update() {
    this.jellfish.update();
    this.particles.update();
  }
}

// Main Class (The Manager)
class App {
  constructor(canvas) {
    // Global variable
    // window.app = this; // indeed not in need

    if (appInstance) {
      return appInstance;
    }
    appInstance = this;

    // Parameters
    this.canvas = canvas;

    // Fetching Utils
    this.tests = new Tests();
    this.sizes = new Sizes(this.canvas);
    this.interval = new Interval();

    // Fetching Three.js Configurations
    this.scene = new THREE.Scene();
    this.camera = new Camera();
    this.renderer = new Renderer();
    this.postprocessing = new Postprocessing();

    // Fitching Three.js Environment
    this.world = new World();

    // Calling Methods
    window.addEventListener('resize', () => {
      this.resize();
    });
    requestAnimationFrame(() => {
      this.update();
    });

    // Finall Log
    console.log('Using Three.js Verizon:', THREE.REVISION);
  }

  // Called once the page is resized
  resize() {
    this.sizes.resize();
    this.camera.resize();
    this.renderer.resize();
    this.world.update();
  }

  // Called every frame (60fps)
  update() {
    if (this.tests.active) {
      this.tests.stats.begin();
      this.interval.update();
      this.camera.update();
      this.renderer.update();
      this.postprocessing.update();
      this.world.update();
      requestAnimationFrame(() => {
        this.update();
      });
      this.tests.stats.end();
    } else {
      this.interval.update();
      this.camera.update();
      this.renderer.update();
      this.postprocessing.update();
      this.world.update();
      requestAnimationFrame(() => {
        this.update();
      });
    }
  }
}

/**
 * Initialization
 */
let appInstance = null; // used in App()

const body = document.body;
const canvas = document.createElement('CANVAS');

const init = () => {
  const loading = document.getElementById('loading-panel');
  loading.style.opacity = '0';
  window.setTimeout(() => {
    loading.style.display = 'none';
  }, 500);

  start();
};

// Ment to start the XP anywhere, not just init()
const start = () => {
  canvas.setAttribute('id', 'webgl');
  body.appendChild(canvas);
  const app = new App(canvas);
};
