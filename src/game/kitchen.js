// @ts-nocheck
import shell from "./shell.html?raw";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function start(root) {
  root.innerHTML = shell;
  const $ = id => root.querySelector("#" + id);

  const renderer = new THREE.WebGLRenderer({ canvas: root.querySelector("#gl"), antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffd9b8);
  scene.fog = new THREE.Fog(0xffd9b8, 18, 36);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  const camTarget = new THREE.Vector3(0, 0.4, 0.2);
  const camBase = new THREE.Vector3(0, 7.6, 7.6);
  const washCam = new THREE.Vector3(0, 2.35, 2.55);
  const washLook = new THREE.Vector3(0, 0.72, 0);
  const peelCam = new THREE.Vector3(0, 3.15, 5.2);
  const peelLook = new THREE.Vector3(0, 0.9, 0);
  camera.position.copy(camBase);

  scene.add(new THREE.HemisphereLight(0xfff3e0, 0xc08060, 0.95));
  const sun = new THREE.DirectionalLight(0xffe2b0, 1.35);
  sun.position.set(5.5, 11, 6.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 28;
  const d = 8;
  Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  const container = root.querySelector("#game-container");
  function resize() {
    const rect = container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width || window.innerWidth));
    const h = Math.max(1, Math.round(rect.height || window.innerHeight));
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    renderer.setPixelRatio(Math.min(coarse ? 1.75 : 2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    const portrait = h > w * 1.05;
    camera.aspect = w / Math.max(1, h);
    camera.fov = 42;
    camBase.set(0, portrait ? 5.35 : 7.6, portrait ? 5.55 : 7.6);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);
  window.visualViewport?.addEventListener("resize", resize);
  resize();

  function flatMat(color, extra = {}) {
    return new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.65, metalness: 0.05, ...extra });
  }
  function addMesh(geo, material, parent) {
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  const wood = new THREE.TextureLoader().load("/assets/wood-counter.webp");
  wood.colorSpace = THREE.SRGBColorSpace;
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
  wood.repeat.set(4, 2.4);
  const counter = addMesh(
    new THREE.BoxGeometry(16, 1.2, 10),
    new THREE.MeshStandardMaterial({ map: wood, roughness: 0.82, flatShading: true }),
    scene,
  );
  counter.position.y = -0.6;
  addMesh(new THREE.BoxGeometry(16.1, 0.22, 0.28), flatMat(0xc4844a), scene).position.set(0, -0.08, 4.9);

  const wall = addMesh(new THREE.BoxGeometry(16, 7, 0.5), flatMat(0xffe8cc), scene);
  wall.position.set(0, 3, -4.8);
  const tileColors = [0xffd6a5, 0xfdffb6, 0xcaffbf, 0xffadad];
  for (let x = -6.5; x <= 6.5; x += 1.3) {
    for (let y = 0.8; y <= 3.4; y += 1.3) {
      const tile = addMesh(new THREE.BoxGeometry(1.18, 1.18, 0.08), flatMat(tileColors[Math.abs(Math.round(x + y)) % 4]), scene);
      tile.position.set(x, y, -4.52);
    }
  }
  addMesh(new THREE.BoxGeometry(7, 0.18, 0.9), flatMat(0xc88a55), scene).position.set(-2.5, 3.4, -4.2);
  [0xff6b6b, 0xffd93d, 0x6bcb77, 0x4d96ff].forEach((color, idx) => {
    const jar = addMesh(new THREE.CylinderGeometry(0.22, 0.22, 0.55, 8), flatMat(0xffffff, { transparent: true, opacity: 0.85 }), scene);
    jar.position.set(-4.5 + idx * 0.75, 3.75, -4.15);
    addMesh(new THREE.CylinderGeometry(0.24, 0.24, 0.12, 8), flatMat(color), jar).position.y = 0.3;
  });

  const modelTemplates = {};
  const gltfLoader = new GLTFLoader();
  const modelFiles = {
    pod: "/assets/bean-pod.glb",
    slice: "/assets/bean-slice.glb",
    board: "/assets/board.glb",
    knife: "/assets/knife.glb",
  };
  function modelInstance(key, targetSize) {
    const wrapper = new THREE.Group();
    const source = modelTemplates[key];
    const model = source ? source.clone(true) : new THREE.Group();
    model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = Array.isArray(child.material)
        ? child.material.map(material => material.clone())
        : child.material?.clone();
    });
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    if (!bounds.isEmpty()) {
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);
      wrapper.scale.setScalar(targetSize / Math.max(size.x, size.y, size.z, 0.0001));
    }
    return wrapper;
  }
  function tintModel(rootObject, color) {
    rootObject.traverse(child => {
      if (!child.isMesh || !child.material) return;
      const list = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of list) material?.color?.copy(color);
    });
  }
  function podModel(size, dirtCount, fiberCount, withEnds = false) {
    const wrapper = new THREE.Group();
    const source = modelTemplates.pod;
    const model = source ? source.clone(true) : new THREE.Group();
    model.traverse(child => {
      if (!child.isMesh) return;
      child.castShadow = true;
      child.receiveShadow = true;
      child.material = Array.isArray(child.material)
        ? child.material.map(material => material.clone())
        : child.material?.clone();
    });
    wrapper.add(model);
    wrapper.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(model);
    const dims = bounds.getSize(new THREE.Vector3());
    const center = bounds.getCenter(new THREE.Vector3());
    if (!bounds.isEmpty()) {
      model.position.sub(center);
      wrapper.scale.setScalar(size / Math.max(dims.x, dims.y, dims.z, 0.0001));
    }
    const dirts = [];
    for (let i = 0; i < dirtCount; i++) {
      const speck = addMesh(
        new THREE.DodecahedronGeometry(Math.max(dims.y * 0.28, 0.004), 0),
        flatMat(0x6b4423),
        model,
      );
      const t = dirtCount === 1 ? 0 : i / (dirtCount - 1) - 0.5;
      speck.position.set(
        center.x + t * dims.x * 0.7,
        bounds.max.y - dims.y * 0.08,
        center.z + (i % 2 ? 1 : -1) * dims.z * 0.28,
      );
      dirts.push(speck);
    }
    const ends = [];
    let axis = "x";
    if (withEnds) {
      if (dims.y >= dims.x && dims.y >= dims.z) axis = "y";
      else if (dims.z >= dims.x && dims.z >= dims.y) axis = "z";
    }
    const span = Math.max(dims.x, dims.y, dims.z, 0.0001);
    wrapper.userData = { dirts, fibers: [], ends, axis, half: span * 0.46 };
    return wrapper;
  }

  const stations = { 1: new THREE.Group(), 2: new THREE.Group(), 3: new THREE.Group(), 4: new THREE.Group(), 5: new THREE.Group() };
  Object.values(stations).forEach(group => {
    group.visible = false;
    scene.add(group);
  });

  const basin = new THREE.Group();
  stations[1].add(basin);
  addMesh(new THREE.CylinderGeometry(2.1, 1.5, 1, 16, 1, true), flatMat(0x64b5f6, { side: THREE.DoubleSide }), basin).position.y = 0.5;
  addMesh(new THREE.CylinderGeometry(1.5, 1.5, 0.12, 16), flatMat(0x42a5f5), basin).position.y = 0.06;
  addMesh(new THREE.CylinderGeometry(1.92, 1.92, 0.08, 16), flatMat(0x80deea, { transparent: true, opacity: 0.72 }), basin).position.y = 0.72;
  const stage1Beans = [];
  const peeler = new THREE.Group();
  peeler.add(addMesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), flatMat(0xff7043), new THREE.Group()));
  {
    const handle = peeler.children[0];
    handle.rotation.x = Math.PI / 2;
    handle.position.z = 0.65;
    const head = addMesh(new THREE.BoxGeometry(0.45, 0.06, 0.35), flatMat(0xcfd8dc, { metalness: 0.35, roughness: 0.28 }), peeler);
    head.position.set(0, 0, 0);
  }
  peeler.position.set(1.8, 1.15, 0.8);
  peeler.rotation.set(0.3, -0.4, 0.2);
  stations[1].add(peeler);

  const boardGroup = new THREE.Group();
  stations[2].add(boardGroup);
  const stage2Beans = new THREE.Group();
  stations[2].add(stage2Beans);
  const sliceGuide = addMesh(
    new THREE.BoxGeometry(0.07, 0.46, 1.7),
    new THREE.MeshBasicMaterial({ color: 0xffeb3b, transparent: true, opacity: 0.75 }),
    stations[2],
  );
  sliceGuide.position.set(-1.2, 0.55, 0.1);
  const knife = new THREE.Group();
  stations[2].add(knife);
  const slicedPieces = new THREE.Group();
  stations[2].add(slicedPieces);

  const eggBowl = new THREE.Group();
  stations[3].add(eggBowl);
  const bowlPoints = [new THREE.Vector2(0, 0)];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    bowlPoints.push(new THREE.Vector2(0.98 + Math.sin(t * Math.PI * 0.5) * 0.58, t * 0.78));
  }
  const bowlShell = addMesh(new THREE.LatheGeometry(bowlPoints, 32), flatMat(0xfff8e7, { side: THREE.DoubleSide }), eggBowl);
  bowlShell.position.y = 0.04;
  const eggLiquidMat = flatMat(0xfff4d2, { transparent: true, opacity: 0.62, depthWrite: false });
  const eggWhiteColor = new THREE.Color(0xfff4d2);
  const eggYolkColor = new THREE.Color(0xffc107);
  const eggLiquid = addMesh(new THREE.CylinderGeometry(1.05, 1.05, 0.08, 24), eggLiquidMat, eggBowl);
  eggLiquid.position.y = 0.2;
  eggLiquid.renderOrder = 2;
  eggLiquid.scale.set(0.01, 1, 0.01);
  const yolks = new THREE.Group();
  eggBowl.add(yolks);
  const wholeEggs = [];
  const whisk = new THREE.Group();
  stations[3].add(whisk);
  addMesh(new THREE.CylinderGeometry(0.08, 0.1, 1.1, 8), flatMat(0xff7043), whisk).position.y = 0.95;
  for (let w = 0; w < 4; w++) {
    const loop = addMesh(new THREE.TorusGeometry(0.24, 0.02, 6, 12), flatMat(0xcfd8dc, { metalness: 0.35 }), whisk);
    loop.scale.set(0.7, 1.4, 1);
    loop.position.y = 0.25;
    loop.rotation.y = (w * Math.PI) / 4;
  }
  whisk.position.set(1.9, 0.8, 0.4);
  whisk.rotation.z = 0.25;

  function stoveAt(x) {
    const stove = new THREE.Group();
    addMesh(new THREE.BoxGeometry(3.4, 0.35, 3.2), flatMat(0x546e7a), stove).position.y = 0.175;
    addMesh(new THREE.CylinderGeometry(1.15, 1.25, 0.12, 16), flatMat(0x263238), stove).position.y = 0.38;
    const flame = addMesh(new THREE.TorusGeometry(0.95, 0.08, 8, 20), new THREE.MeshBasicMaterial({ color: 0x29b6f6 }), stove);
    flame.rotation.x = Math.PI / 2;
    flame.position.y = 0.45;
    stove.position.x = x;
    stove.userData.flame = flame;
    return stove;
  }
  stations[4].add(stoveAt(-0.55));
  const pot = new THREE.Group();
  pot.position.set(-0.55, 0.45, 0);
  stations[4].add(pot);
  addMesh(new THREE.CylinderGeometry(1.02, 0.94, 1.02, 18, 1, true), flatMat(0xb0bec5, { side: THREE.DoubleSide, metalness: 0.3 }), pot).position.y = 0.55;
  addMesh(new THREE.CylinderGeometry(0.94, 0.94, 0.1, 18), flatMat(0x90a4ae), pot).position.y = 0.08;
  addMesh(new THREE.CylinderGeometry(0.96, 0.96, 0.08, 18), flatMat(0x81d4fa, { transparent: true, opacity: 0.8 }), pot).position.y = 0.9;
  const blanchBeans = new THREE.Group();
  stations[4].add(blanchBeans);

  stations[5].add(stoveAt(-0.7));
  const wok = new THREE.Group();
  wok.position.set(-0.7, 0.48, 0);
  stations[5].add(wok);
  addMesh(
    new THREE.SphereGeometry(1.75, 18, 12, 0, Math.PI * 2, Math.PI * 0.56, Math.PI * 0.44),
    flatMat(0x37474f, { side: THREE.DoubleSide, roughness: 0.4, metalness: 0.35 }),
    wok,
  ).position.y = 1.65;
  const wokHandle = addMesh(new THREE.CylinderGeometry(0.1, 0.13, 1.5, 8), flatMat(0x6d4c41), wok);
  wokHandle.rotation.z = Math.PI / 2.3;
  wokHandle.position.set(-2.2, 1.25, 0);
  const wokOil = addMesh(new THREE.CircleGeometry(0.95, 16), flatMat(0xffe082, { transparent: true, opacity: 0 }), wok);
  wokOil.rotation.x = -Math.PI / 2;
  wokOil.position.y = 0.32;
  const eggPool = addMesh(new THREE.CircleGeometry(0.9, 24), flatMat(0xffc107, { transparent: true, opacity: 0 }), wok);
  eggPool.rotation.x = -Math.PI / 2;
  eggPool.position.y = 0.36;
  eggPool.visible = false;
  const wokFood = new THREE.Group();
  wokFood.position.y = 0.38;
  wok.add(wokFood);
  const spatula = new THREE.Group();
  stations[5].add(spatula);
  const spatHandle = addMesh(new THREE.CylinderGeometry(0.06, 0.07, 1.4, 8), flatMat(0xff7043), spatula);
  spatHandle.rotation.x = Math.PI / 3;
  spatHandle.position.set(0, 0.65, 0.6);
  addMesh(new THREE.BoxGeometry(0.55, 0.04, 0.65), flatMat(0xeceff1), spatula).position.y = 0.1;
  spatula.position.set(0.3, 1.4, 0.5);
  const plate = new THREE.Group();
  plate.position.set(2.35, 0.08, 0.3);
  stations[5].add(plate);
  addMesh(new THREE.CylinderGeometry(1.35, 1.05, 0.14, 20), flatMat(0xffffff), plate);
  const rim = addMesh(new THREE.TorusGeometry(1.22, 0.06, 8, 24), flatMat(0xff8a65), plate);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.06;
  const plated = new THREE.Group();
  plated.position.y = 0.14;
  plate.add(plated);

  const particles = [];
  const puffGeo = new THREE.SphereGeometry(0.07, 6, 6);
  const rippleGeo = new THREE.RingGeometry(0.08, 0.13, 18);
  function burst(origin, color, count = 8, speed = 2.2) {
    if (particles.length > 90) return;
    const material = new THREE.MeshBasicMaterial({ color });
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(puffGeo, material);
      mesh.position.copy(origin);
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random()) * speed;
      particles.push({
        mesh,
        vel: new THREE.Vector3(Math.cos(angle) * spd, (0.6 + Math.random()) * speed, Math.sin(angle) * spd),
        life: 0.6,
        max: 0.6,
      });
      scene.add(mesh);
    }
  }
  function splash(dx, speed, dirty) {
    if (particles.length > 90) return;
    const dir = Math.sign(dx) || 1;
    const force = Math.min(2.2, 0.7 + speed / 28);
    const water = new THREE.MeshBasicMaterial({ color: 0xd7f3f4, transparent: true, opacity: 0.9 });
    for (let i = 0; i < (speed > 16 ? 4 : 2); i++) {
      const mesh = new THREE.Mesh(puffGeo, water);
      mesh.position.set((Math.random() - 0.5) * 0.8, 0.72, (Math.random() - 0.5) * 0.45);
      particles.push({
        mesh,
        vel: new THREE.Vector3(dir * force * (0.5 + Math.random()), 1.1 + Math.random() * 0.8, (Math.random() - 0.5) * 0.7),
        life: 0.42,
        max: 0.42,
      });
      scene.add(mesh);
    }
    if (dirty) {
      const mud = new THREE.MeshBasicMaterial({ color: 0x8a6844 });
      const speck = new THREE.Mesh(puffGeo, mud);
      speck.position.set((Math.random() - 0.5) * 0.5, 0.7, (Math.random() - 0.5) * 0.3);
      particles.push({
        mesh: speck,
        vel: new THREE.Vector3(dir * 0.4, 0.7, (Math.random() - 0.5) * 0.4),
        life: 0.5,
        max: 0.5,
      });
      scene.add(speck);
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xc5ebe6, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(rippleGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set((Math.random() - 0.5) * 0.6, 0.36, (Math.random() - 0.5) * 0.35);
    particles.push({ mesh: ring, vel: new THREE.Vector3(), life: 0.5, max: 0.5, ripple: true });
    scene.add(ring);
  }
  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        if (p.ripple) p.mesh.material.dispose();
        particles.splice(i, 1);
        continue;
      }
      if (p.ripple) {
        const grow = 1 + (1 - p.life / p.max) * 4.2;
        p.mesh.scale.setScalar(grow);
        p.mesh.material.opacity = 0.5 * (p.life / p.max);
        continue;
      }
      p.vel.y -= 7 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.scale.setScalar(Math.max(0.05, p.life / p.max));
    }
  }

  const music = new Audio("/assets/audio/kitchen-music.mp3");
  music.loop = true;
  music.volume = 0.01;
  function syncMusic() {
    const close = beds.water || beds.whisk || beds.boil || beds.sizzle;
    music.volume = close ? 0.003 : 0.01;
  }
  const chopPool = Array.from({ length: 4 }, () => {
    const voice = new Audio("/assets/audio/chop.mp3");
    voice.preload = "auto";
    voice.volume = 0.8;
    return voice;
  });
  let chopCursor = 0;
  function playChop(rate) {
    if (muted) return;
    const voice = chopPool[chopCursor];
    chopCursor = (chopCursor + 1) % chopPool.length;
    voice.playbackRate = rate;
    if (voice.readyState >= 2) voice.currentTime = 0;
    voice.play().catch(() => {});
  }
  const sfxDing = new Audio("/assets/audio/ding.mp3");
  sfxDing.volume = 0.4;
  let muted = false;
  let audioContext = null;
  function play(audio) {
    if (muted || !audio) return;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
  let noiseWhite = null;
  let noiseBrown = null;
  let voices = 0;
  const beds = {};
  function ensureAudio() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    if (!noiseWhite) {
      const rate = audioContext.sampleRate;
      const make = brown => {
        const buffer = audioContext.createBuffer(1, rate * 2, rate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          if (brown) {
            last = last * 0.985 + white * 0.015;
            data[i] = last * 4.5;
          } else data[i] = white;
        }
        return buffer;
      };
      noiseWhite = make(false);
      noiseBrown = make(true);
    }
    if (!beds.master) {
      beds.master = audioContext.createGain();
      beds.master.gain.value = muted ? 0 : 1;
      beds.master.connect(audioContext.destination);
    }
  }
  function noiseBurst(freq, dur, amount, type, brown) {
    if (muted || voices >= 5) return;
    ensureAudio();
    voices += 1;
    const src = audioContext.createBufferSource();
    src.buffer = brown ? noiseBrown : noiseWhite;
    const filter = audioContext.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = type === "lowpass" ? 0.7 : 0.8;
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, amount), t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(gain).connect(beds.master);
    src.onended = () => { voices = Math.max(0, voices - 1); };
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }
  function shua() {
    if (muted) return;
    ensureAudio();
    const src = audioContext.createBufferSource();
    src.buffer = noiseWhite;
    const filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.55;
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;
    filter.frequency.setValueAtTime(2400, t);
    filter.frequency.exponentialRampToValueAtTime(380, t + 0.34);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.14, t + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(filter).connect(gain).connect(beds.master);
    src.start(t, Math.random() * 0.4);
    src.stop(t + 0.42);
  }
  function bowl(freq, amount, dur = 0.34) {
    if (muted) return;
    ensureAudio();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const t = audioContext.currentTime;
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(amount, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(beds.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  function tapChoice(correct) {
    if (muted) return;
    if (correct) {
      bowl(523, 0.06, 0.22);
      bowl(784, 0.03, 0.28);
      noiseBurst(1800, 0.04, 0.03, "highpass");
    } else {
      bowl(196, 0.05, 0.16);
      noiseBurst(240, 0.06, 0.04, "lowpass", true);
    }
  }
  function zoneChime() {
    bowl(660, 0.055, 0.28);
    bowl(990, 0.028, 0.36);
    noiseBurst(1400, 0.05, 0.025, "highpass");
  }
  function startBed(key, opts) {
    if (beds[key]) return;
    ensureAudio();
    const src = audioContext.createBufferSource();
    src.buffer = noiseBrown;
    src.loop = true;
    const filter = audioContext.createBiquadFilter();
    filter.type = opts.type;
    filter.frequency.value = opts.freq;
    filter.Q.value = opts.q;
    const wobble = audioContext.createGain();
    wobble.gain.value = 0.72;
    const lfo = audioContext.createOscillator();
    const lfoGain = audioContext.createGain();
    lfo.frequency.value = opts.lfo;
    lfoGain.gain.value = 0.28;
    lfo.connect(lfoGain).connect(wobble.gain);
    const gain = audioContext.createGain();
    gain.gain.value = opts.gain;
    src.connect(filter).connect(wobble).connect(gain).connect(beds.master);
    src.start();
    lfo.start();
    beds[key] = { src, lfo, gain };
    syncMusic();
  }
  function setBedGain(key, value) {
    const bed = beds[key];
    if (!bed || !audioContext) return;
    bed.gain.gain.setTargetAtTime(value, audioContext.currentTime, 0.06);
  }
  function stopBed(key) {
    const bed = beds[key];
    if (!bed || !audioContext) return;
    delete beds[key];
    const t = audioContext.currentTime;
    bed.gain.gain.cancelScheduledValues(t);
    bed.gain.gain.setValueAtTime(bed.gain.gain.value, t);
    bed.gain.gain.linearRampToValueAtTime(0, t + 0.16);
    bed.src.stop(t + 0.18);
    bed.lfo.stop(t + 0.18);
    syncMusic();
  }
  function silenceBeds() {
    ["water", "whisk", "boil", "sizzle"].forEach(stopBed);
  }
  function shellCrack() {
    noiseBurst(1800, 0.045, 0.1, "highpass");
    noiseBurst(320, 0.08, 0.07, "lowpass", true);
    noiseBurst(420, 0.11, 0.06, "lowpass", true);
  }
  function tickAmbience(dt) {
    if (!audioContext) return;
    if (game.state === "PLAYING" && game.stage === 4 && game.s4 === "BOILING") {
      startBed("boil", { freq: 420, q: 0.6, type: "lowpass", gain: 0.2, lfo: 4.5 });
      game.bubble -= dt;
      if (game.bubble <= 0) {
        game.bubble = 0.07 + Math.random() * 0.16;
        noiseBurst(500 + Math.random() * 700, 0.05 + Math.random() * 0.04, 0.055, "bandpass");
      }
    } else stopBed("boil");
    if (game.state === "PLAYING" && game.stage === 5) {
      startBed("sizzle", { freq: 2400, q: 0.45, type: "highpass", gain: 0.14, lfo: 11 });
      setBedGain("sizzle", 0.18 + Math.min(0.08, (game.heat - 25) / 900));
      game.crackle -= dt;
      if (game.crackle <= 0) {
        game.crackle = 0.035 + Math.random() * 0.08;
        noiseBurst(1400 + Math.random() * 1800, 0.03 + Math.random() * 0.03, 0.045, "highpass");
      }
    } else stopBed("sizzle");
  }

  const ui = {
    stage: $("stageName"),
    timer: $("timer"),
    score: $("score"),
    tip: $("tip"),
    meter: $("meter"),
    zone: $("zone"),
    needle: $("needle"),
    label: $("meterLabel"),
    action: $("action"),
    popup: $("popup"),
  };
  let popupTimer = 0;
  function popup(text, good = true) {
    ui.popup.textContent = text;
    ui.popup.style.color = good ? "#ff7a59" : "#7a6a60";
    ui.popup.style.opacity = 1;
    clearTimeout(popupTimer);
    popupTimer = setTimeout(() => { ui.popup.style.opacity = 0; }, 800);
  }
  function showMeter(label, start = 0, end = 0) {
    const on = Boolean(label);
    ui.meter.style.display = ui.label.style.display = on ? "block" : "none";
    ui.label.textContent = label || "";
    if (on) {
      ui.zone.style.left = start * 100 + "%";
      ui.zone.style.width = (end - start) * 100 + "%";
    }
  }
  function setNeedle(value) {
    game.needleTarget = THREE.MathUtils.clamp(value, 0, 1);
  }
  function showCoach(text, seconds, pause) {
    $("coachText").textContent = text;
    $("coach").classList.add("show");
    game.coachUntil = performance.now() + seconds * 1000;
    game.coachPause = pause;
  }
  function hideCoach() {
    $("coach").classList.remove("show");
    game.coachUntil = 0;
    game.coachPause = false;
  }

  const TIPS = [
    { name: "1. 清洗與去頭尾", wash: "順著箭頭，慢慢從左劃到右。完整劃過三次，泥土才會刷掉。", peel: "一整根四角豆。左邊豆頭向上劃，右邊豆尾向下劃。" },
    { name: "2. 切片", tip: "刀移到豆上時點按，或按「下刀」，切成星形薄片。" },
    { name: "3. 敲蛋與打蛋", crack: "點按雞蛋，把三顆蛋敲進碗裡。", whisk: "順著虛線慢慢畫大圈。穩穩畫滿 3 圈就好，不用快。" },
    { name: "4. 汆燙四角豆", drop: "按下按鈕，把四角豆放進滾水。", cook: "來回滑動攪拌。變成鮮綠、指針在綠色時撈起。" },
    { name: "5. 翻炒與滑蛋", oil: "點「倒油」，或在畫面上向下滑。", beans: "點「放下四角豆」，把燙好的豆下鍋。", fry: "順著 S 形虛線慢慢劃。左右來回 3 次，把四角豆炒得油亮。", egg: "點「淋入蛋液」，或向下滑，蓋住四角豆。", push: "從鍋邊向鍋心輕推，或點「向鍋心推」。推 3 下。", heat: "按住鍋柄收汁。指針進了綠色就鬆手關火。" },
  ];
  const TIMES = [26, 22, 24, 24, 44];

  const game = {
    state: "TITLE",
    stage: 1,
    score: 0,
    timer: 26,
    progress: 0,
    mistakes: 0,
    down: false,
    lastX: 0,
    lastY: 0,
    s1: "WASH",
    wash: 0,
    strokes: 0,
    washIntro: 0,
    washReady: false,
    peel: 0,
    trims: 0,
    peelIntro: 0,
    peelReady: false,
    knifeX: -1.35,
    knifeDir: 1,
    cuts: 0,
    cutCd: 0,
    chop: 0,
    s3: "CRACK",
    cracked: 0,
    whisk: 0,
    laps: 0,
    lap: 0,
    whiskDir: 0,
    lastAngle: null,
    s4: "READY",
    doneness: 0,
    stir: 0,
    s5: "FRY",
    fries: 0,
    pushes: 0,
    heat: 45,
    cook: 0,
    tilt: 0,
    bubble: 0,
    crackle: 0,
    needle: 0,
    needleTarget: 0,
    coachUntil: 0,
    coachPause: false,
    lastAction: 0,
    zoneHit: false,
    splashAt: 0,
    rubDir: 0,
    streak: 0,
  };

  function showStation(n) {
    for (const [key, group] of Object.entries(stations)) group.visible = Number(key) === n;
  }
  function clearGroup(group) {
    while (group.children.length) group.remove(group.children[0]);
  }
  function resetStations() {
    game.s1 = "WASH";
    game.wash = 0;
    game.strokes = 0;
    game.washReady = false;
    game.peel = 0;
    game.trims = 0;
    game.peelReady = false;
    unfocusWash();
    stage1Beans.forEach((bean, idx) => {
      bean.position.set((idx - 1) * 0.2, 0.68, (idx - 1) * 0.42);
      bean.rotation.set(0, (idx - 1) * 0.35, 0);
      bean.userData.dirts.forEach(speck => { speck.visible = true; });
    });
    peeler.position.set(1.8, 1.15, 0.8);
    game.knifeX = -1.35;
    game.knifeDir = 1;
    game.cuts = 0;
    game.chop = 0;
    stage2Beans.visible = true;
    stage2Beans.scale.set(1, 1, 1);
    stage2Beans.position.x = 0;
    clearGroup(slicedPieces);
    game.s3 = "CRACK";
    game.cracked = 0;
    game.whisk = 0;
    game.laps = 0;
    game.lap = 0;
    game.whiskDir = 0;
    game.lastAngle = null;
    wholeEggs.forEach((egg, i) => {
      egg.visible = true;
      egg.position.set(-2.35, 0.42, (i - 1) * 1.1);
    });
    eggLiquid.scale.set(0.01, 1, 0.01);
    eggLiquidMat.color.setHex(0xfff4d2);
    eggLiquidMat.opacity = 0.62;
    clearGroup(yolks);
    yolks.scale.setScalar(1);
    yolks.rotation.set(0, 0, 0);
    whisk.position.set(1.9, 0.8, 0.4);
    game.s4 = "READY";
    game.doneness = 0;
    game.stir = 0;
    clearGroup(blanchBeans);
    parkBlanchBeans();
    game.s5 = "FRY";
    game.fries = 0;
    game.pushes = 0;
    game.streak = 0;
    game.heat = 45;
    game.cook = 0;
    game.tilt = 0;
    game.tiltDir = 1;
    wokOil.material.opacity = 0;
    eggPool.visible = false;
    eggPool.material.opacity = 0;
    wok.visible = true;
    wok.position.set(-0.7, 0.48, 0);
    wok.rotation.z = 0;
    spatula.visible = true;
    stations[5].children[0].visible = true;
    plate.position.set(2.35, 0.08, 0.3);
    plate.rotation.y = 0;
    clearGroup(wokFood);
    clearGroup(plated);
  }

  function focusWash() {
    const guide = $("strokeGuide");
    guide.hidden = false;
    guide.classList.remove("at-head", "at-tail", "up", "down");
    const trims = $("trimGuides");
    if (trims) trims.hidden = true;
  }
  function showWholePod() {
    basin.visible = false;
    peeler.visible = false;
    stage1Beans.forEach((bean, i) => {
      bean.visible = i === 1;
      if (i !== 1) return;
      bean.position.set(0, 0.9, 0);
      const axis = bean.userData.axis || "x";
      if (axis === "y") bean.rotation.set(0, 0, Math.PI / 2);
      else if (axis === "z") bean.rotation.set(0, Math.PI / 2, 0);
      else bean.rotation.set(0.08, 0, 0);
    });
  }
  function setTrimGuide(which) {
    const guide = $("strokeGuide");
    guide.hidden = true;
    const trims = $("trimGuides");
    trims.hidden = false;
    $("trimHead").classList.toggle("wait", which !== "head");
    $("trimTail").classList.toggle("wait", which !== "tail");
    placeTrimArrows();
  }
  const tipScratch = new THREE.Vector3();
  function framePeel() {
    const bean = stage1Beans[1] || stage1Beans[0];
    const half = (bean?.userData.half || 0.9) * (bean?.scale.x || 1) + 0.18;
    const v = THREE.MathUtils.degToRad(camera.fov);
    const h = 2 * Math.atan(Math.tan(v / 2) * Math.max(0.35, camera.aspect));
    const dist = half / Math.tan(h / 2) / 0.86;
    const dir = new THREE.Vector3(0, 0.28, 1).normalize();
    peelCam.copy(peelLook).addScaledVector(dir, Math.max(2.4, dist));
  }
  function projectPoint(point) {
    tipScratch.copy(point).project(camera);
    const rect = container.getBoundingClientRect();
    return {
      x: (tipScratch.x * 0.5 + 0.5) * rect.width,
      y: (-tipScratch.y * 0.5 + 0.5) * rect.height,
    };
  }
  function placeTrimArrows() {
    const bean = stage1Beans[1] || stage1Beans[0];
    const guides = $("trimGuides");
    if (!bean || !guides || guides.hidden) return;
    const axis = bean.userData.axis || "x";
    const half = bean.userData.half || 0.85;
    const head = new THREE.Vector3();
    const tail = new THREE.Vector3();
    head[axis] = -half;
    tail[axis] = half;
    bean.updateMatrixWorld(true);
    const a = projectPoint(bean.localToWorld(head));
    const b = projectPoint(bean.localToWorld(tail));
    if (![a.x, a.y, b.x, b.y].every(Number.isFinite)) return;
    const rect = container.getBoundingClientRect();
    const padX = 40;
    const padY = 90;
    const clamp = point => {
      point.x = Math.min(rect.width - padX, Math.max(padX, point.x));
      point.y = Math.min(rect.height - padY, Math.max(padY, point.y));
      return point;
    };
    const left = clamp(a.x <= b.x ? a : b);
    const right = clamp(a.x <= b.x ? b : a);
    game.headPt = left;
    game.tailPt = right;
    const headEl = $("trimHead");
    const tailEl = $("trimTail");
    headEl.style.left = left.x + "px";
    headEl.style.top = left.y + "px";
    tailEl.style.left = right.x + "px";
    tailEl.style.top = right.y + "px";
    tailEl.style.right = "auto";
  }
  function snipEnd(which) {
    const bean = stage1Beans[1] || stage1Beans[0];
    if (bean) {
      const at = bean.position.clone();
      at.x += which === 0 ? -0.85 : 0.85;
      at.y += 0.2;
      burst(at, 0xc6d98a, 8, 1.6);
    }
    noiseBurst(2400, 0.05, 0.08, "highpass");
    noiseBurst(160, 0.04, 0.045, "lowpass", true);
    game.trims += 1;
    game.progress = (game.trims / 2) * 100;
    popup(which === 0 ? "豆頭去掉了" : "豆尾去掉了");
    if (game.trims < 2) {
      setTrimGuide("tail");
      ui.tip.textContent = "再到右邊豆尾，向下劃一下。";
      showCoach("在豆尾向下劃", 1.4, false);
      return;
    }
    $("trimGuides").hidden = true;
    completeStage("頭尾都乾淨了！", 98);
  }
  function finishTrim() {
    if (game.state !== "PLAYING" || game.stage !== 1 || game.s1 !== "PEEL" || !game.peelReady) return;
    const rect = container.getBoundingClientRect();
    const dy = game.lastY - game.strokeY;
    const dx = game.lastX - game.strokeX;
    const midX = (game.strokeX + game.lastX) / 2 - rect.left;
    const midY = (game.strokeY + game.lastY) / 2 - rect.top;
    if (Math.abs(dy) < rect.height * 0.12) return;
    if (Math.abs(dy) < Math.abs(dx)) {
      popup("上下劃，不要左右劃", false);
      return;
    }
    const wantUp = game.trims === 0;
    const target = wantUp ? game.headPt : game.tailPt;
    const reach = Math.min(rect.width, rect.height) * 0.2;
    if (!target || Math.hypot(midX - target.x, midY - target.y) > reach) {
      popup(wantUp ? "在左邊豆頭向上劃" : "在右邊豆尾向下劃", false);
      return;
    }
    if (wantUp ? dy > -rect.height * 0.16 : dy < rect.height * 0.16) {
      popup(wantUp ? "豆頭要向上劃" : "豆尾要向下劃", false);
      return;
    }
    snipEnd(wantUp ? 0 : 1);
  }
  function unfocusWash() {
    basin.visible = true;
    peeler.visible = true;
    const guide = $("strokeGuide");
    if (guide) {
      guide.hidden = true;
      guide.classList.remove("at-head", "at-tail", "up", "down");
    }
    const trims = $("trimGuides");
    if (trims) trims.hidden = true;
    stage1Beans.forEach((bean, idx) => {
      bean.visible = true;
      bean.position.set((idx - 1) * 0.2, 0.68, (idx - 1) * 0.42);
      bean.rotation.set(0, (idx - 1) * 0.35, 0);
    });
  }
  function brushDirt() {
    const bean = stage1Beans[1] || stage1Beans[0];
    if (!bean) return;
    const step = game.strokes / 3;
    stage1Beans.forEach(item => {
      item.userData.dirts.forEach((speck, i) => {
        speck.visible = i / item.userData.dirts.length >= step;
      });
    });
    if (bean) burst(bean.position.clone().setY(1.15), 0x8a6844, 8, 1.5);
  }
  function finishStroke() {
    if (game.state !== "PLAYING" || game.stage !== 1 || game.s1 !== "WASH" || !game.washReady) return;
    const rect = container.getBoundingClientRect();
    const start = (game.strokeX - rect.left) / rect.width;
    const end = (game.strokeMax - rect.left) / rect.width;
    const span = end - start;
    const elapsed = performance.now() - game.strokeT;
    const straight = Math.abs(game.lastY - game.strokeY) < rect.height * 0.34;
    if (span < 0.18) return;
    if (elapsed < 340) {
      popup("慢一點，順著紋理劃", false);
      return;
    }
    if (!(span >= 0.42 && start < 0.4 && end > 0.66 && straight)) {
      popup("從左完整劃到右", false);
      return;
    }
    game.strokes += 1;
    game.wash = game.strokes / 3 * 100;
    game.progress = game.wash;
    brushDirt();
    shua();
    popup(game.strokes >= 3 ? "泥土刷乾淨了" : `唰，刷掉三分之一`);
    ui.tip.textContent = game.strokes >= 3 ? TIPS[0].peel : `順著紋理再劃 ${3 - game.strokes} 次`;
    if (game.strokes < 3) return;
    game.s1 = "PEEL";
    game.progress = 0;
    game.zoneHit = false;
    game.needle = 0;
    ui.meter.classList.remove("in-zone");
    showMeter("去頭去尾", 0.5, 1);
    game.trims = 0;
    game.peelReady = false;
    game.peelIntro = performance.now();
    ui.tip.textContent = "先看整根四角豆。";
    $("strokeGuide").hidden = true;
    showWholePod();
  }
  function hidePlayChrome() {
    showMeter(null);
    ui.meter.classList.remove("in-zone");
    hideCoach();
    const guide = $("strokeGuide");
    if (guide) {
      guide.hidden = true;
      guide.classList.remove("at-head", "at-tail", "up", "down");
    }
    const trims = $("trimGuides");
    if (trims) trims.hidden = true;
    const ring = $("whiskRing");
    if (ring) ring.hidden = true;
    const fry = $("fryGuide");
    if (fry) {
      fry.hidden = true;
      fry.classList.remove("rtl");
    }
    const arrows = $("eggArrows");
    if (arrows) arrows.hidden = true;
    ui.action.style.display = "none";
    ui.action.classList.remove("pulse");
    ui.action.onclick = null;
  }
  function armAction(label, fn) {
    ui.action.style.display = "block";
    ui.action.textContent = label;
    ui.action.onclick = event => {
      event.stopPropagation();
      fn();
    };
  }

  function scoreStage(accuracy) {
    const acc = Math.max(55, Math.min(100, accuracy));
    const points = Math.round(acc * 1.15 + Math.max(0, game.timer) * 2);
    game.score += points;
    ui.score.textContent = game.score + " 分";
    return { acc: Math.round(acc), points };
  }
  function holdCard(title, text, label) {
    $("stageCardTitle").textContent = title;
    $("stageCardText").textContent = text;
    $("nextStageBtn").textContent = label;
    $("stageCard").style.display = "flex";
    hidePlayChrome();
  }
  function completeStage(title, accuracy) {
    if (game.state !== "PLAYING") return;
    game.state = "CLEAR";
    silenceBeds();
    const result = scoreStage(accuracy);
    if (game.stage === 5) noiseBurst(880, 0.09, 0.05, "bandpass");
    play(sfxDing);
    burst(new THREE.Vector3(0, 1.3, 0), 0xffd54f, 16, 3);
    const next = game.stage < 5 ? "下一關" : "看看成績";
    holdCard(title, `本關 +${result.points} 分　·　精準 ${result.acc}%　·　累計 ${game.score} 分`, next);
  }

  function sliceNow() {
    if (game.state !== "PLAYING" || game.stage !== 2 || game.cutCd > 0) return;
    game.cutCd = 0.22;
    game.chop = 1;
    const targetX = -1.2 + (game.cuts / 10) * 2.4;
    const perfect = Math.abs(game.knifeX - targetX) < 0.55;
    game.cuts += 1;
    playChop(perfect ? 1.05 : 0.96);
    noiseBurst(160, 0.07, perfect ? 0.05 : 0.035, "lowpass", true);
    if (perfect) zoneChime();
    popup(perfect ? "切得漂亮！" : "差一點點", perfect);
    if (!perfect) game.mistakes += 0.6;
    burst(new THREE.Vector3(game.knifeX, 0.55, 0.1), perfect ? 0x76ff03 : 0xc6ff00, 6, 2);
    const piece = modelInstance("slice", 0.42);
    piece.position.set(-1.3 + game.cuts * 0.24, 0.56, (game.cuts % 3 - 1) * 0.38);
    piece.rotation.y = Math.random() * Math.PI;
    slicedPieces.add(piece);
    const remain = Math.max(0.04, 1 - game.cuts / 10);
    stage2Beans.scale.x = remain;
    stage2Beans.position.x = (1 - remain) * 1.2;
    game.progress = (game.cuts / 10) * 100;
    if (game.cuts >= 10) {
      stage2Beans.visible = false;
      completeStage("切得漂亮！", Math.max(65, 100 - game.mistakes * 6));
    }
  }
  function crackEgg() {
    if (game.state !== "PLAYING" || game.stage !== 3 || game.s3 !== "CRACK") return;
    const egg = wholeEggs[game.cracked];
    if (!egg) return;
    egg.visible = false;
    game.cracked += 1;
    shellCrack();
    popup(`敲開第 ${game.cracked} 顆！`);
    burst(new THREE.Vector3(-0.2, 1.1, 0), 0xfff1dc, 8, 2);
    const fill = Math.min(0.92, 0.46 + game.cracked * 0.16);
    eggLiquid.scale.set(fill, 1, fill);
    const yolk = addMesh(new THREE.SphereGeometry(0.3, 20, 14), flatMat(0xff9100), yolks);
    yolk.renderOrder = 3;
    yolk.scale.set(1.08, 0.78, 1.08);
    const spots = [[0.28, 0.36, -0.1], [-0.28, 0.34, -0.04], [0, 0.4, -0.22]];
    yolk.position.fromArray(spots[game.cracked - 1] || spots[0]);
    game.progress = (game.cracked / 3) * 40;
    if (game.cracked >= 3) {
      game.s3 = "WHISK";
      game.laps = 0;
      game.lap = 0;
      game.whisk = 0;
      game.whiskDir = 0;
      game.lastAngle = null;
      $("whiskRing").hidden = false;
      ui.tip.textContent = TIPS[2].whisk;
      showMeter("順著虛線畫圈", 0.66, 1);
      showCoach("順著虛線慢慢畫", 2.2, false);
      popup("畫滿 3 圈");
    }
  }
  function parkBlanchBeans() {
    if (!modelTemplates.slice) return;
    for (let i = 0; i < 12; i++) {
      const slice = modelInstance("slice", 0.52);
      slice.rotation.set(0.4, (i / 12) * Math.PI * 2, 0.2);
      blanchBeans.add(slice);
    }
    blanchBeans.visible = false;
  }
  function dropBeans() {
    if (game.s4 !== "READY") return;
    game.s4 = "BOILING";
    noiseBurst(280, 0.14, 0.09, "lowpass", true);
    startBed("boil", { freq: 420, q: 0.6, type: "lowpass", gain: 0.22, lfo: 4.5 });
    burst(new THREE.Vector3(-0.55, 1.3, 0), 0x81d4fa, 14, 2.4);
    popup("下鍋了！");
    ui.tip.textContent = TIPS[3].cook;
    showMeter("四角豆爽脆度", 0.62, 0.84);
    blanchBeans.visible = true;
    blanchBeans.children.forEach((slice, i) => {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 0.18 + (i % 3) * 0.22;
      slice.position.set(-0.55 + Math.cos(angle) * radius, 1.02, Math.sin(angle) * radius);
    });
    armAction("撈起四角豆", scoopBeans);
  }
  function scoopBeans() {
    if (game.s4 !== "BOILING") return;
    game.s4 = "DONE";
    const d = game.doneness;
    let acc = 70;
    let title = "汆燙完成！";
    if (d >= 62 && d <= 84) {
      acc = 100 - Math.abs(73 - d);
      title = "爽脆度剛剛好！";
      popup("鮮綠剛剛好！");
    } else if (d < 62) {
      acc = Math.max(55, 50 + d * 0.6);
      title = "清新偏生！";
      popup("稍微偏生", false);
    } else {
      acc = Math.max(55, 100 - (d - 84) * 2.2);
      title = "燙得軟了一點！";
      popup("燙久了一點", false);
    }
    blanchBeans.children.forEach((slice, idx) => {
      const angle = idx * 0.7;
      slice.position.set(-0.55 + Math.cos(angle) * 0.2, 1.42, Math.sin(angle) * 0.2);
      tintModel(slice, new THREE.Color(d >= 55 ? 0x2ec44d : 0x62cf55));
    });
    noiseBurst(640, 0.1, 0.06, "bandpass");
    noiseBurst(220, 0.12, 0.05, "lowpass", true);
    if (d >= 62 && d <= 84) zoneChime();
    completeStage(title, acc);
  }
  function glossBeans(step) {
    const color = new THREE.Color().setHSL(0.3, 0.62, 0.34 + step * 0.05);
    wokFood.children.forEach(child => {
      if (child.userData.kind === "bean") tintModel(child, color);
    });
  }
  function jumpWok() {
    wokFood.children.forEach(child => {
      if (child.userData.kind !== "bean" && child.userData.kind !== "curd") return;
      child.position.y = 0.42 + Math.random() * 0.45;
      child.rotation.x += 1.1;
      child.rotation.z += 0.4;
    });
    burst(new THREE.Vector3(-0.7, 1.15, 0), 0xfff8e8, 10, 2.2);
  }
  function beginWok() {
    clearGroup(wokFood);
    game.s5 = "OIL";
    game.fries = 0;
    game.pushes = 0;
    game.doneness = 0;
    game.zoneHit = false;
    wokOil.material.opacity = 0;
    eggPool.visible = false;
    $("fryGuide").hidden = true;
    $("eggArrows").hidden = true;
    showMeter(null);
    ui.tip.textContent = TIPS[4].oil;
    armAction("倒油", pourOil);
    popup("熱鍋了");
  }
  function pourOil() {
    if (game.state !== "PLAYING" || game.s5 !== "OIL") return;
    game.s5 = "BEANS";
    wokOil.material.opacity = 0.72;
    for (let i = 0; i < 8; i++) {
      const garlic = addMesh(new THREE.DodecahedronGeometry(0.07, 0), flatMat(0xfff1dc), wokFood);
      garlic.position.set((Math.random() - 0.5) * 0.9, 0.06, (Math.random() - 0.5) * 0.9);
      garlic.userData.kind = "garlic";
    }
    noiseBurst(2400, 0.1, 0.07, "highpass");
    noiseBurst(180, 0.08, 0.04, "lowpass", true);
    startBed("sizzle", { freq: 2400, q: 0.45, type: "highpass", gain: 0.14, lfo: 11 });
    popup("油熱了");
    ui.tip.textContent = TIPS[4].beans;
    armAction("放下四角豆", pourBeans);
  }
  function pourBeans() {
    if (game.state !== "PLAYING" || game.s5 !== "BEANS") return;
    for (let i = 0; i < 10; i++) {
      const slice = modelInstance("slice", 0.36);
      slice.position.set((Math.random() - 0.5) * 1.05, 0.08, (Math.random() - 0.5) * 1.05);
      slice.rotation.set(Math.random(), Math.random() * 3, Math.random());
      slice.userData.kind = "bean";
      wokFood.add(slice);
    }
    glossBeans(0);
    noiseBurst(1600, 0.08, 0.05, "highpass");
    popup("四角豆下鍋！");
    game.s5 = "FRY";
    game.fries = 0;
    $("fryGuide").hidden = false;
    $("fryGuide").classList.remove("rtl");
    ui.action.style.display = "none";
    ui.action.onclick = null;
    ui.tip.textContent = TIPS[4].fry;
    showCoach("順著虛線慢慢劃", 2, false);
  }
  function finishFry() {
    if (game.state !== "PLAYING" || game.stage !== 5 || game.s5 !== "FRY") return;
    const rect = container.getBoundingClientRect();
    const start = (game.strokeX - rect.left) / rect.width;
    const end = (game.lastX - rect.left) / rect.width;
    const span = Math.abs(end - start);
    const elapsed = performance.now() - game.strokeT;
    if (span < 0.2) return;
    if (elapsed < 420) {
      popup("慢一點，順著鍋鏟劃", false);
      return;
    }
    const wantLtr = game.fries % 2 === 0;
    const good = wantLtr ? start < 0.38 && end > 0.66 : start > 0.62 && end < 0.34;
    if (!good || span < 0.42) {
      popup(wantLtr ? "從左完整劃到右" : "從右完整劃回左", false);
      return;
    }
    game.fries += 1;
    game.tilt = 1;
    game.tiltDir = wantLtr ? 1 : -1;
    game.progress = (game.fries / 3) * 34;
    glossBeans(game.fries);
    jumpWok();
    noiseBurst(2100, 0.1, 0.07, "highpass");
    noiseBurst(420, 0.08, 0.05, "bandpass");
    popup(game.fries >= 3 ? "豆香鎖住了" : "滋啦——");
    if (game.fries < 3) {
      $("fryGuide").classList.toggle("rtl", game.fries % 2 === 1);
      ui.tip.textContent = game.fries % 2 === 0 ? "從左再劃到右。" : "從右劃回左。";
      return;
    }
    $("fryGuide").hidden = true;
    game.s5 = "EGG";
    ui.tip.textContent = TIPS[4].egg;
    armAction("淋入蛋液", pourEgg);
  }
  function pourEgg() {
    if (game.state !== "PLAYING" || game.s5 !== "EGG") return;
    game.s5 = "PUSH";
    game.pushes = 0;
    eggPool.visible = true;
    eggPool.material.opacity = 0.84;
    eggPool.material.color.setHex(0xffc107);
    eggPool.scale.set(1, 1, 1);
    $("eggArrows").hidden = false;
    noiseBurst(460, 0.14, 0.07, "bandpass");
    popup("蛋液蓋住四角豆了");
    ui.tip.textContent = TIPS[4].push;
    armAction("向鍋心推", () => applyPush(false));
    showCoach("從外往內輕推", 1.6, false);
  }
  function wokCenter() {
    const ring = $("eggArrows");
    const rect = ring && !ring.hidden ? ring.getBoundingClientRect() : null;
    if (rect && rect.width > 40) return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const box = container.getBoundingClientRect();
    return { x: box.left + box.width / 2, y: box.top + box.height * 0.42 };
  }
  function applyPush(fromGesture) {
    if (game.state !== "PLAYING" || game.s5 !== "PUSH") return;
    game.pushes += 1;
    const k = game.pushes / 3;
    eggPool.scale.setScalar(1 - k * 0.12);
    eggPool.material.opacity = 0.84 - k * 0.28;
    eggPool.material.color.setHex(k >= 1 ? 0xf6d36b : 0xffc107);
    for (let i = 0; i < 2; i++) {
      const curd = addMesh(new THREE.SphereGeometry(0.16, 10, 8), flatMat(0xffe082), wokFood);
      curd.scale.set(1.5, 0.32, 0.85);
      curd.position.set((Math.random() - 0.5) * 0.7, 0.14, (Math.random() - 0.5) * 0.7);
      curd.userData.kind = "curd";
    }
    noiseBurst(520, 0.06, 0.04, "bandpass");
    popup(game.pushes >= 3 ? "裹住了" : `推了 ${game.pushes} 下`);
    game.progress = 34 + game.pushes * 12;
    if (game.pushes < 3) {
      ui.tip.textContent = `再向鍋心推 ${3 - game.pushes} 下。`;
      armAction("向鍋心推", () => applyPush(false));
      return;
    }
    $("eggArrows").hidden = true;
    game.s5 = "HEAT";
    game.skipHeat = !!fromGesture;
    game.doneness = 0;
    game.zoneHit = false;
    ui.action.style.display = "none";
    ui.action.onclick = null;
    showMeter("完美滑嫩", 0.62, 0.78);
    ui.tip.textContent = TIPS[4].heat;
    showCoach("按住，進綠色再放", 1.8, false);
    popup("按住鍋柄收汁");
  }
  function finishPush() {
    if (game.state !== "PLAYING" || game.stage !== 5 || game.s5 !== "PUSH") return;
    const moved = Math.hypot(game.lastX - game.strokeX, game.lastY - game.strokeY);
    if (moved < 24) return;
    const center = wokCenter();
    const start = Math.hypot(game.strokeX - center.x, game.strokeY - center.y);
    const nearest = Math.min(start, game.pushNear);
    const inward = start - nearest > 18 || Math.hypot(game.lastX - center.x, game.lastY - center.y) < start - 16;
    if (!inward) {
      popup("從鍋邊向鍋心推", false);
      return;
    }
    applyPush(true);
  }
  function finishPourStep() {
    if (game.state !== "PLAYING" || game.stage !== 5) return;
    const dy = game.lastY - game.strokeY;
    const moved = Math.hypot(game.lastX - game.strokeX, dy);
    if (moved < 32 || dy < 20) return;
    if (game.s5 === "OIL") pourOil();
    else if (game.s5 === "BEANS") pourBeans();
    else if (game.s5 === "EGG") pourEgg();
  }
  function settleEgg(perfect) {
    if (game.s5 !== "HEAT" || game.state !== "PLAYING") return;
    game.s5 = "DONE";
    ui.meter.classList.remove("in-zone");
    if (perfect) {
      eggPool.material.color.setHex(0xffe7a0);
      eggPool.material.opacity = 0.72;
      game.tilt = 1;
      burst(new THREE.Vector3(-0.7, 1.25, 0), 0xffd54f, 16, 3);
      zoneChime();
      popup("滑嫩滿分！");
      completeStage("滑嫩滿分！", 98);
      return;
    }
    game.mistakes += 1;
    eggPool.material.color.setHex(0xc47a2c);
    eggPool.material.opacity = 0.5;
    wokFood.children.forEach(child => {
      if (child.userData.kind !== "curd") return;
      tintModel(child, new THREE.Color(0xc47a2c));
      child.scale.multiplyScalar(0.82);
    });
    popup("阿媽話熟啲穩陣！", false);
    completeStage("阿媽話熟啲穩陣！", 74);
  }
  function finishHeat() {
    if (game.state !== "PLAYING" || game.stage !== 5 || game.s5 !== "HEAT") return;
    if (game.skipHeat) {
      game.skipHeat = false;
      return;
    }
    if (game.doneness < 62) {
      popup("再按住，等指針進綠色", false);
      return;
    }
    settleEgg(game.doneness <= 78);
  }

  function beginStage(index) {
    game.stage = index;
    game.state = "PLAYING";
    game.timer = TIMES[index - 1];
    game.progress = 0;
    game.mistakes = 0;
    showStation(index);
    hidePlayChrome();
    const tip = TIPS[index - 1];
    ui.stage.textContent = tip.name;
    ui.timer.textContent = "⏱ " + game.timer + " 秒";
    if (index === 1) {
      showMeter("順著紋理劃過", 0.66, 1);
      game.needle = 0;
      game.needleTarget = 0;
      game.zoneHit = false;
      game.strokes = 0;
      game.washReady = false;
      game.washIntro = performance.now();
      game.lastAction = performance.now();
      unfocusWash();
      camera.position.copy(camBase);
      ui.tip.textContent = "先看整盤四角豆，再拉近來刷。";
    } else if (index === 2) {
      ui.tip.textContent = tip.tip;
      showMeter("刀落在豆上再下刀", 0.3, 0.5);
      armAction("下刀", sliceNow);
    } else if (index === 3) {
      ui.tip.textContent = tip.crack;
    } else if (index === 4) {
      ui.tip.textContent = tip.drop;
      armAction("放入四角豆", dropBeans);
    } else {
      beginWok();
    }
    popup(`第 ${index} 站！`);
  }

  const dishCam = new THREE.Vector3(0.2, 2.7, 3.15);
  const dishLook = new THREE.Vector3(0, 0.35, 0);
  function starCount(score) {
    if (score >= 680) return 5;
    if (score >= 540) return 4;
    if (score >= 420) return 3;
    if (score >= 300) return 2;
    return 1;
  }
  function finishGame() {
    game.state = "DISH";
    hidePlayChrome();
    $("stageCard").style.display = "none";
    $("hud").style.visibility = "hidden";
    $("tip").style.visibility = "hidden";
    showStation(5);
    wok.visible = false;
    spatula.visible = false;
    stations[5].children[0].visible = false;
    plate.position.set(0, 0.16, 0);
    plate.rotation.y = 0;
    clearGroup(plated);
    for (let i = 0; i < 12; i++) {
      const piece = modelInstance("slice", 0.38);
      const angle = (i / 12) * Math.PI * 2;
      const radius = 0.18 + (i % 3) * 0.22;
      piece.position.set(Math.cos(angle) * radius, (i % 4) * 0.045, Math.sin(angle) * radius);
      piece.rotation.set(Math.random() * 0.6, Math.random() * 3, Math.random() * 0.4);
      plated.add(piece);
    }
    for (let i = 0; i < 8; i++) {
      const fluff = addMesh(new THREE.DodecahedronGeometry(0.16, 0), flatMat(0xffd54f), plated);
      const angle = i * 1.15;
      fluff.position.set(Math.cos(angle) * (0.12 + (i % 3) * 0.2), 0.1, Math.sin(angle) * (0.12 + (i % 3) * 0.2));
    }
    game.score += marketBonus;
    ui.score.textContent = game.score + " 分";
    const earned = starCount(game.score);
    const km = 480 + (marketSelection.beans ? 520 : 80) + (marketSelection.eggs ? 180 : 40) + Math.round(game.score * 0.15);
    const co2 = (km * 0.00068).toFixed(2);
    const today = new Date();
    const name = chefName();
    $("certRank").textContent = `稱號：${earned}星級惜食有機大廚`;
    $("certName").textContent = `致：${name}`;
    $("certBody").textContent = `衷心感謝${name}親身體驗從「本地有機農墟選材」到「家庭暖心烹調」的低碳旅程。每一口鮮嫩爽脆的本地有機四角豆，都是對香港永續農業與減碳生活的珍貴支持！`;
    $("certDate").textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
    $("certScore").textContent = `${game.score.toLocaleString("en-US")} 分`;
    $("certKm").textContent = `−${km.toLocaleString("en-US")} km`;
    $("certCo2").innerHTML = `${co2} kg CO<sub>2</sub>`;
    $("certBonus").textContent = marketBonus > 0 ? `選用本地有機食材 +${marketBonus} 分` : "";
    $("certBonus").hidden = marketBonus <= 0;
    $("result").style.display = "none";
    const box = $("dishStars");
    box.replaceChildren();
    for (let i = 0; i < 5; i++) {
      const star = document.createElement("span");
      star.textContent = "☆";
      box.appendChild(star);
    }
    $("dishScore").textContent = "0 分";
    $("dishNote").textContent = "";
    $("toCertBtn").hidden = true;
    $("dish").style.display = "flex";
    let lit = 0;
    const stamp = () => {
      if (game.state !== "DISH") return;
      if (lit >= earned) {
        $("dishScore").textContent = `${game.score.toLocaleString("en-US")} 分`;
        const taste = earned >= 5 ? "這碟滑嫩滿分" : earned >= 3 ? "家常味道正好" : "還可以再嫩一點";
        $("dishNote").textContent = marketBonus > 0 ? `${taste}　·　選用本地有機食材 +${marketBonus} 分` : taste;
        $("toCertBtn").hidden = false;
        return;
      }
      box.children[lit].textContent = "★";
      box.children[lit].classList.add("on");
      lit += 1;
      const shown = lit === earned ? game.score : Math.round((game.score * lit) / earned);
      $("dishScore").textContent = `${shown.toLocaleString("en-US")} 分`;
      play(sfxDing);
      setTimeout(stamp, 520);
    };
    setTimeout(stamp, 640);
  }

  const marketSelection = { beans: null, eggs: null };
  let marketBonus = 0;
  function paintChoice(id, statusId, on, onLabel, wrong) {
    const button = $(id);
    button.classList.toggle("selected", on);
    button.classList.toggle("wrong", on && wrong);
    button.setAttribute("aria-pressed", String(on));
    $(statusId).textContent = on ? onLabel : "點選";
  }
  function updateMarketUI() {
    paintChoice("beanChoice", "beanChoiceStatus", marketSelection.beans === true, "已選用", false);
    paintChoice("beanWrong", "beanWrongStatus", marketSelection.beans === false, "已選用", true);
    paintChoice("eggChoice", "eggChoiceStatus", marketSelection.eggs === true, "已選用", false);
    paintChoice("eggWrong", "eggWrongStatus", marketSelection.eggs === false, "已選用", true);
    const ready = marketSelection.beans !== null && marketSelection.eggs !== null;
    $("freshnessPreview").textContent = ready ? "兩樣都選好了" : "請為四角豆和雞蛋各選一種";
  }
  function chefName() {
    return ($("chefName").value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, 12);
  }
  function startCooking() {
    if (!chefName()) {
      $("freshnessPreview").textContent = "請先寫下你的名字";
      $("chefName").focus();
      return;
    }
    if (marketSelection.beans === null || marketSelection.eggs === null) {
      $("freshnessPreview").textContent = "請為四角豆和雞蛋各選一種";
      return;
    }
    $("market").style.display = "none";
    $("result").style.display = "none";
    $("stageCard").style.display = "none";
    resetStations();
    marketBonus = (marketSelection.beans ? 30 : 0) + (marketSelection.eggs ? 30 : 0);
    game.score = 0;
    ui.score.textContent = "0 分";
    beginStage(1);
  }
  let starting = false;
  async function openMarket() {
    if (starting) return;
    starting = true;
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    music.play().catch(() => {});
    $("startBtn").textContent = "正在準備農墟…";
    await modelsReady;
    $("start").style.display = "none";
    $("result").style.display = "none";
    $("market").style.display = "flex";
    marketSelection.beans = null;
    marketSelection.eggs = null;
    $("startBtn").textContent = "前往農墟選材";
    updateMarketUI();
    starting = false;
  }
  $("beanChoice").onclick = () => { marketSelection.beans = true; updateMarketUI(); tapChoice(true); };
  $("beanWrong").onclick = () => { marketSelection.beans = false; updateMarketUI(); tapChoice(false); };
  $("eggChoice").onclick = () => { marketSelection.eggs = true; updateMarketUI(); tapChoice(true); };
  $("eggWrong").onclick = () => { marketSelection.eggs = false; updateMarketUI(); tapChoice(false); };
  $("startBtn").onclick = openMarket;
  $("cookBtn").onclick = startCooking;
  $("againBtn").onclick = () => {
    $("result").style.display = "none";
    $("dish").style.display = "none";
    $("hud").style.visibility = "";
    $("tip").style.visibility = "";
    marketSelection.beans = null;
    marketSelection.eggs = null;
    $("market").style.display = "flex";
    updateMarketUI();
    game.state = "TITLE";
  };
  $("toCertBtn").onclick = () => {
    if (game.state !== "DISH") return;
    $("dish").style.display = "none";
    game.state = "RESULT";
    $("result").style.display = "flex";
    play(sfxDing);
  };
  async function saveCertificate() {
    if (document.fonts && document.fonts.status !== "loaded") await document.fonts.ready;
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1000;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffe4c4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#d4533a";
    ctx.font = "900 40px 'Noto Sans TC', sans-serif";
    ctx.fillText($("certRank").textContent, 800, 72);
    roundRect(ctx, 80, 100, 1440, 840, 28);
    ctx.fillStyle = "#fffdf8";
    ctx.fill();
    ctx.strokeStyle = "#e7a56a";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#2f6b34";
    ctx.font = "900 28px 'Noto Sans TC', sans-serif";
    ctx.fillText("惜聚廚房 × 香港本地有機農墟", 130, 170);
    ctx.textAlign = "right";
    ctx.fillStyle = "#8a7764";
    ctx.font = "700 24px 'Noto Sans TC', sans-serif";
    ctx.fillText($("certDate").textContent, 1470, 170);
    ctx.strokeStyle = "#f0d3b0";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(130, 198);
    ctx.lineTo(1470, 198);
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#4a2a16";
    ctx.font = "900 46px 'Noto Sans TC', sans-serif";
    ctx.fillText("香港本地有機生活支持者感謝狀", 800, 268);
    ctx.fillStyle = "#c45b3a";
    ctx.font = "900 36px 'Noto Sans TC', sans-serif";
    ctx.fillText($("certName").textContent, 800, 322);
    ctx.fillStyle = "#5a3318";
    ctx.font = "500 26px 'Noto Sans TC', sans-serif";
    const who = $("certName").textContent.replace(/^致：/, "");
    ctx.fillText(`衷心感謝${who}親身體驗從「本地有機農墟選材」到「家庭暖心烹調」的低碳旅程。`, 800, 378);
    ctx.fillText("每一口鮮嫩爽脆的本地有機四角豆，都是對香港永續農業與減碳生活的珍貴支持！", 800, 422);
    roundRect(ctx, 140, 470, 1320, 210, 22);
    ctx.fillStyle = "#fff6ea";
    ctx.fill();
    ctx.strokeStyle = "#f0d3b0";
    ctx.lineWidth = 3;
    ctx.stroke();
    const stats = [
      ["烹飪總積分", $("certScore").textContent, "#e25b2a"],
      ["減少食物里程", $("certKm").textContent, "#1e7a34"],
      ["低碳惜食減排", $("certCo2").textContent.replace(/CO2$/, "CO₂"), "#243028"],
    ];
    stats.forEach((item, i) => {
      const x = 360 + i * 440;
      ctx.textAlign = "center";
      ctx.fillStyle = "#7a6552";
      ctx.font = "700 24px 'Noto Sans TC', sans-serif";
      ctx.fillText(item[0], x, 545);
      ctx.fillStyle = item[2];
      ctx.font = "900 48px 'Noto Sans TC', sans-serif";
      ctx.fillText(item[1], x, 615);
    });
    const bonusLine = $("certBonus").textContent;
    if (bonusLine) {
      ctx.fillStyle = "#1e7a34";
      ctx.font = "800 26px 'Noto Sans TC', sans-serif";
      ctx.fillText(bonusLine, 800, 710);
    }
    ctx.textAlign = "left";
    ctx.fillStyle = "#5a3318";
    ctx.font = "800 26px 'Noto Sans TC', sans-serif";
    ctx.fillText("料理認證：本地有機四角豆炒蛋", 140, 790);
    roundRect(ctx, 1040, 748, 390, 62, 31);
    ctx.strokeStyle = "#e7a0ad";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#c45b73";
    ctx.font = "800 24px 'Noto Sans TC', sans-serif";
    ctx.fillText("惜聚廚房大廚印章", 1235, 788);
    const blob = pngBlob(canvas);
    const file = new File([blob], "惜聚廚房-四角豆炒蛋感謝狀.png", { type: "image/png" });
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "惜聚廚房感謝狀" });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return;
      }
    }
    const url = URL.createObjectURL(blob);
    if (touch) {
      openCertSheet(url);
      return;
    }
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  function pngBlob(canvas) {
    const data = canvas.toDataURL("image/png").split(",")[1];
    const raw = atob(data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: "image/png" });
  }
  function openCertSheet(url) {
    let sheet = document.getElementById("certHold");
    if (!sheet) {
      sheet = document.createElement("div");
      sheet.id = "certHold";
      sheet.innerHTML = "<p>長按圖片，就能存到相簿</p><img alt=\"感謝狀\"><button type=\"button\">關閉</button>";
      document.body.appendChild(sheet);
      sheet.querySelector("button").onclick = () => { sheet.hidden = true; };
    }
    sheet.querySelector("img").src = url;
    sheet.hidden = false;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  $("saveCertBtn").onclick = () => { saveCertificate(); };
  $("printCertBtn").onclick = () => { window.print(); };
  $("muteBtn").onclick = () => {
    muted = !muted;
    music.muted = muted;
    if (beds.master) beds.master.gain.value = muted ? 0 : 1;
    $("muteBtn").textContent = muted ? "音效關" : "音效開";
    $("muteBtn").setAttribute("aria-pressed", String(muted));
  };
  $("nextStageBtn").onclick = () => {
    if (game.state !== "CLEAR") return;
    $("stageCard").style.display = "none";
    if (game.stage >= 5) finishGame();
    else beginStage(game.stage + 1);
  };

  const canvas = renderer.domElement;
  const viewSize = () => {
    const rect = container.getBoundingClientRect();
    return { w: rect.width || window.innerWidth, h: rect.height || window.innerHeight };
  };
  const onPress = (clientX, clientY) => {
    if (game.state !== "PLAYING") return;
    if (game.coachPause) hideCoach();
    game.lastAction = performance.now();
    game.down = true;
    game.lastX = clientX;
    game.lastY = clientY;
    game.rubDir = 0;
    game.strokeX = clientX;
    game.strokeY = clientY;
    game.strokeMax = clientX;
    game.strokeMin = clientX;
    game.strokeT = performance.now();
    game.pushNear = Infinity;
    if (game.stage === 2) sliceNow();
    else if (game.stage === 3 && game.s3 === "CRACK") crackEgg();
  };
  const onScrub = (clientX, clientY) => {
    if (!game.down || game.state !== "PLAYING") return;
    const dx = clientX - game.lastX;
    const dy = clientY - game.lastY;
    const dist = Math.hypot(dx, dy);
    game.lastX = clientX;
    game.lastY = clientY;
    game.lastAction = performance.now();
    if (dist < 2) return;
    const reach = window.matchMedia("(pointer: coarse)").matches ? 0.22 : 0.14;
    const { w, h } = viewSize();
    if (game.stage === 1 && (game.s1 === "WASH" || game.s1 === "PEEL")) {
      if (clientX > game.strokeMax) game.strokeMax = clientX;
      if (clientX < game.strokeMin) game.strokeMin = clientX;
    } else if (game.stage === 3 && game.s3 === "WHISK") {
      const ring = $("whiskRing").getBoundingClientRect();
      const cx = ring.left + ring.width / 2;
      const cy = ring.top + ring.height / 2;
      const radius = ring.width * 0.42;
      const px = clientX - cx;
      const py = clientY - cy;
      const reach = Math.hypot(px, py);
      const angle = Math.atan2(py, px);
      const onLine = reach > radius * 0.62 && reach < radius * 1.38;
      if (!onLine) {
        game.lastAngle = null;
        if (performance.now() - game.splashAt > 800) {
          game.splashAt = performance.now();
          popup("手指留在虛線上", false);
        }
        return;
      }
      let signed = 0;
      if (game.lastAngle !== null) {
        signed = angle - game.lastAngle;
        if (signed > Math.PI) signed -= Math.PI * 2;
        if (signed < -Math.PI) signed += Math.PI * 2;
      }
      const now = performance.now();
      const dt = Math.max(0.016, (now - (game.whiskT || now)) / 1000);
      game.whiskT = now;
      game.lastAngle = angle;
      whisk.position.set(Math.cos(angle) * 0.72, 0.72, Math.sin(angle) * 0.55);
      if (Math.abs(signed) < 0.012) return;
      if (Math.abs(signed) / dt > 5) {
        if (now - game.splashAt > 800) {
          game.splashAt = now;
          popup("慢一點，順著虛線", false);
        }
        return;
      }
      const dir = Math.sign(signed);
      if (game.whiskDir && dir !== game.whiskDir) {
        game.lap = 0;
        game.whiskDir = dir;
        popup("同一方向畫完這一圈", false);
      } else if (!game.whiskDir) game.whiskDir = dir;
      game.lap += Math.abs(signed);
      yolks.rotation.y += signed * 0.35;
      while (game.lap >= Math.PI * 2) {
        game.lap -= Math.PI * 2;
        game.laps += 1;
        zoneChime();
        popup(game.laps >= 3 ? "打好了" : `第 ${game.laps} 圈`);
      }
      game.whisk = Math.min(100, ((game.laps + game.lap / (Math.PI * 2)) / 3) * 100);
      const t = game.whisk / 100;
      yolks.scale.setScalar(Math.max(0.02, 1 - t));
      eggLiquidMat.color.copy(eggWhiteColor).lerp(eggYolkColor, t);
      eggLiquidMat.opacity = 0.62 + t * 0.12;
      game.progress = 40 + game.whisk * 0.6;
      ui.tip.textContent = game.laps >= 3 ? TIPS[2].whisk : `順著虛線再畫 ${3 - game.laps} 圈`;
      startBed("whisk", { freq: 620, q: 0.7, type: "bandpass", gain: 0.07, lfo: 3 });
      setBedGain("whisk", 0.07);
      if (Math.random() < 0.18) noiseBurst(780, 0.04, 0.02, "bandpass");
      if (game.laps >= 3) completeStage("蛋液打得好滑！", 97);
    } else if (game.stage === 4 && game.s4 === "BOILING") {
      game.stir = Math.min(15, game.stir + dist * 0.02);
      if (dist > 8 && performance.now() - game.splashAt > 140) {
        game.splashAt = performance.now();
        noiseBurst(380, 0.05, Math.min(0.06, dist / 500), "bandpass");
      }
    } else if (game.stage === 5 && game.s5 === "FRY") {
      const { w } = viewSize();
      spatula.position.x = (clientX / w - 0.5) * 2.2;
    } else if (game.stage === 5 && game.s5 === "PUSH") {
      const center = wokCenter();
      const near = Math.hypot(clientX - center.x, clientY - center.y);
      if (near < game.pushNear) game.pushNear = near;
    }
  };
  const onRelease = () => {
    const had = game.down;
    game.down = false;
    game.lastAngle = null;
    if (!had) return;
    finishStroke();
    finishTrim();
    finishPourStep();
    finishFry();
    finishPush();
    finishHeat();
    stopBed("water");
    stopBed("whisk");
  };
  const onPointerDown = event => {
    if (event.pointerType === "touch") return;
    onPress(event.clientX, event.clientY);
  };
  const onPointerMove = event => {
    if (event.pointerType === "touch") return;
    onScrub(event.clientX, event.clientY);
  };
  const onPointerUp = event => {
    if (event.pointerType === "touch") return;
    onRelease();
  };
  const touchPoint = event => event.touches[0] || event.changedTouches[0];
  const onTouchStart = event => {
    if (event.cancelable) event.preventDefault();
    const point = touchPoint(event);
    if (point) onPress(point.clientX, point.clientY);
  };
  const onTouchMove = event => {
    if (!game.down) return;
    if (event.cancelable) event.preventDefault();
    const point = event.touches[0];
    if (point) onScrub(point.clientX, point.clientY);
  };
  const onTouchEnd = () => onRelease();
  canvas.addEventListener("pointerdown", onPointerDown);
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onRelease);

  const bright = new THREE.Color(0x2ec44d);
  const modelsReady = Promise.all(Object.entries(modelFiles).map(async ([key, path]) => {
    const gltf = await gltfLoader.loadAsync(path);
    modelTemplates[key] = gltf.scene;
  })).then(() => {
    [-0.42, 0, 0.42].forEach((z, idx) => {
      const bean = podModel(1.9, 7, 4, true);
      bean.position.set((idx - 1) * 0.2, 0.68, z);
      bean.rotation.y = (idx - 1) * 0.35;
      stations[1].add(bean);
      stage1Beans.push(bean);
    });
    boardGroup.add(modelInstance("board", 4.4));
    boardGroup.position.y = 0.16;
    [-0.35, 0.1, 0.55].forEach(z => {
      const bean = podModel(2.55, 0, 0);
      bean.position.set(0, 0, z);
      bean.rotation.y = 0.28;
      stage2Beans.add(bean);
    });
    stations[2].updateMatrixWorld(true);
    const boardTop = new THREE.Box3().setFromObject(boardGroup).max.y;
    stage2Beans.children.forEach(bean => {
      const bottom = new THREE.Box3().setFromObject(bean).min.y;
      bean.position.y += boardTop - bottom + 0.04;
    });
    knife.add(modelInstance("knife", 1.7));
    knife.rotation.y = -0.35;
    [-1.1, 0, 1.1].forEach(z => {
      const egg = addMesh(new THREE.SphereGeometry(0.32, 14, 12), flatMat(0xf7d7b5), stations[3]);
      egg.scale.set(1, 1.32, 1);
      egg.position.set(-2.35, 0.42, z);
      wholeEggs.push(egg);
    });
    showStation(5);
  });

  let lastFrame = performance.now();
  renderer.setAnimationLoop(now => {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    if (game.state === "TITLE" || game.state === "RESULT") {
      camera.position.x = Math.sin(now * 0.0006) * 0.4;
      camera.position.y = camBase.y;
      camera.position.z = camBase.z;
      camera.lookAt(camTarget);
    } else if (game.state === "DISH") {
      camera.position.lerp(dishCam, 0.07);
      camera.lookAt(dishLook);
      plate.rotation.y += dt * 0.28;
    } else if (game.stage === 1 && game.s1 === "WASH" && game.state === "PLAYING") {
      const held = 1200;
      const zoomDur = 1600;
      const t = performance.now() - game.washIntro;
      const u = t < held ? 0 : Math.min(1, (t - held) / zoomDur);
      const e = u * u * (3 - 2 * u);
      camera.position.copy(camBase).lerp(washCam, e);
      camera.lookAt(camTarget.clone().lerp(washLook, e));
      if (e >= 1 && !game.washReady) {
        focusWash();
        game.washReady = true;
        ui.tip.textContent = TIPS[0].wash;
        showCoach("順著箭頭慢慢劃", 2.2, false);
        game.lastAction = performance.now();
      }
    } else if (game.stage === 1 && game.s1 === "PEEL" && game.state === "PLAYING") {
      framePeel();
      camera.position.lerp(peelCam, 0.07);
      camera.lookAt(peelLook);
      if (!game.peelReady && performance.now() - game.peelIntro > 900) {
        game.peelReady = true;
        setTrimGuide("head");
        ui.tip.textContent = TIPS[0].peel;
        showCoach("在左邊豆頭向上劃", 1.6, false);
        game.lastAction = performance.now();
      }
      if (!$("trimGuides").hidden) placeTrimArrows();
    } else {
      camera.position.lerp(camBase, 0.08);
      camera.lookAt(camTarget);
    }

    if (game.state === "PLAYING") {
      const coaching = game.coachPause && performance.now() < game.coachUntil;
      if (performance.now() >= game.coachUntil) $("coach").classList.remove("show");
      const holding = game.stage === 1 && ((game.s1 === "WASH" && !game.washReady) || (game.s1 === "PEEL" && !game.peelReady));
      if (!coaching && !holding) game.timer -= dt;
      ui.timer.textContent = "⏱ " + Math.ceil(Math.max(0, game.timer)) + " 秒";
      if (!coaching && game.timer <= 0) {
        game.timer = 0;
        const titles = ["時間到", "切片完成！", "打蛋完成！", "汆燙完成！", "翻炒完成！"];
        completeStage(titles[game.stage - 1], Math.max(60, game.progress));
      }
      if (game.stage === 1 && game.state === "PLAYING") {
        setNeedle(game.s1 === "WASH" ? game.strokes / 3 : game.trims / 2);
        ui.meter.classList.toggle("in-zone", game.s1 === "WASH" ? game.strokes >= 2 : game.trims >= 1);
        if (coaching) game.lastAction = performance.now();
        else if ((game.s1 === "WASH" ? game.washReady : game.peelReady) && !game.down && performance.now() - game.lastAction > 5000) {
          showCoach(game.s1 === "WASH" ? "順著箭頭慢慢劃" : (game.trims ? "在豆尾向下劃" : "在豆頭向上劃"), 1.6, false);
          game.lastAction = performance.now();
        }
      }
      if (game.stage === 2 && game.state === "PLAYING") {
        game.cutCd = Math.max(0, game.cutCd - dt);
        const speed = 2.4 + game.cuts * 0.12;
        game.knifeX += game.knifeDir * speed * dt;
        if (game.knifeX > 1.45) { game.knifeX = 1.45; game.knifeDir = -1; }
        if (game.knifeX < -1.45) { game.knifeX = -1.45; game.knifeDir = 1; }
        game.chop = Math.max(0, game.chop - dt * 6);
        const drop = Math.sin(game.chop * Math.PI) * 0.72;
        knife.position.set(game.knifeX, 0.95 - drop, 0.15);
        const targetX = -1.2 + (Math.min(game.cuts, 9) / 10) * 2.4;
        sliceGuide.position.x = targetX;
        const center = (targetX + 1.45) / 2.9;
        showMeter("刀落在豆上再下刀", center - 0.16, center + 0.16);
        setNeedle((game.knifeX + 1.45) / 2.9);
        ui.action.classList.toggle("pulse", Math.abs(game.knifeX - targetX) < 0.55 && game.cuts < 10);
      }
      if (game.stage === 3 && game.s3 === "WHISK") setNeedle(game.whisk / 100);
      if (game.stage === 4 && game.s4 === "BOILING" && game.state === "PLAYING") {
        game.doneness = Math.min(100, game.doneness + (11.5 + game.stir * 0.35) * dt);
        game.progress = game.doneness;
        setNeedle(game.doneness / 100);
        const ready = game.doneness >= 62 && game.doneness <= 84;
        ui.action.classList.toggle("pulse", ready);
        ui.tip.textContent = ready ? "鮮綠了，快撈起！" : game.doneness > 84 ? "太熟了，快撈起！" : TIPS[3].cook;
        if (Math.random() < dt * 6) burst(new THREE.Vector3(-0.55 + (Math.random() - 0.5), 1.15, (Math.random() - 0.5)), 0xffffff, 1, 1);
        blanchBeans.children.forEach((slice, idx) => {
          slice.position.y = 1.12 + Math.sin(now * 0.012 + idx) * 0.05;
          if (game.doneness >= 55) tintModel(slice, bright);
        });
      }
      if (game.stage === 5 && game.state === "PLAYING") {
        if (game.s5 === "HEAT" && game.down) {
          game.doneness = Math.min(100, game.doneness + 12 * dt);
          setNeedle(game.doneness / 100);
          const sweet = game.doneness >= 62 && game.doneness <= 78;
          ui.meter.classList.toggle("in-zone", sweet);
          ui.tip.textContent = sweet ? "滑嫩了，鬆手關火！" : game.doneness > 78 ? "快鬆手，要老了！" : TIPS[4].heat;
          if (sweet && !game.zoneHit) {
            game.zoneHit = true;
            zoneChime();
          }
          if (game.doneness >= 94) settleEgg(false);
        }
        game.tilt = Math.max(0, game.tilt - dt * 3.8);
        const arc = Math.sin(game.tilt * Math.PI);
        const dir = game.tiltDir || 1;
        wok.position.x = -0.7 + arc * 0.28 * dir;
        wok.position.y = 0.48 + arc * 0.38;
        wok.rotation.z = arc * 0.34 * dir;
        if (game.s5 !== "FRY") spatula.position.x = 0.3 - arc * 0.7;
        wokFood.children.forEach(child => {
          if (child.position.y > 0.08) child.position.y = Math.max(0.08, child.position.y - 1.8 * dt);
        });
        if (Math.random() < dt * 5) burst(new THREE.Vector3(-0.7 + (Math.random() - 0.5) * 0.4, 1.05, (Math.random() - 0.5) * 0.4), 0xfffaf2, 1, 1.2);
        stations[5].children[0].userData.flame.scale.setScalar(0.85 + (game.s5 === "HEAT" ? 0.35 + game.doneness / 180 : 0.7));
      }
      tickAmbience(dt);
    }
    game.needle += (game.needleTarget - game.needle) * Math.min(1, dt * 14);
    ui.needle.style.left = game.needle * 98 + "%";
    updateParticles(dt);
    renderer.render(scene, camera);
  });

  const stop = () => {
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    window.removeEventListener("orientationchange", resize);
    window.visualViewport?.removeEventListener("resize", resize);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    canvas.removeEventListener("pointerdown", onPointerDown);
    canvas.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
    window.removeEventListener("touchcancel", onRelease);
    silenceBeds();
    music.pause();
    renderer.dispose();
    root.replaceChildren();
  };
  return stop;
}
