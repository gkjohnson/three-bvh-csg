var e="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:"undefined"!=typeof window?window:"undefined"!=typeof global?global:{},n={},i={},t=e.parcelRequirefee5;null==t&&((t=function(e){if(e in n)return n[e].exports;if(e in i){var t=i[e];delete i[e];var r={id:e,exports:{}};return n[e]=r,t.call(r.exports,r,r.exports),r.exports}var o=new Error("Cannot find module '"+e+"'");throw o.code="MODULE_NOT_FOUND",o}).register=function(e,n){i[e]=n},e.parcelRequirefee5=t);var r=t("ilwiq"),o=t("fUhpq"),a=t("5Rd1x"),d=t("4CEV9");let l,w,s,c,p,g,f,u,h,m,b=new r.Plane,T=new r.Vector3;const v=[new r.Triangle(new r.Vector3(-.25,1.25,.25),new r.Vector3(-.25,.25,.25),new r.Vector3(-1.25,1.25,.25))],x=[new r.Triangle(new r.Vector3(-.5,.5,-.5),new r.Vector3(-.5,-.5,-.5),new r.Vector3(-.5,.5,.5)),new r.Triangle(new r.Vector3(-.5,.5,-.5),new r.Vector3(-.5,.5,.5),new r.Vector3(.5,.5,-.5))];!function(){l=new r.WebGLRenderer({antialias:!0}),l.setPixelRatio(window.devicePixelRatio),l.setSize(window.innerWidth,window.innerHeight),l.setClearColor(1118481,1),document.body.appendChild(l.domElement),s=new r.Scene,s.fog=new r.Fog(16763432,20,60);const e=new r.DirectionalLight(16777215,3.5);e.position.set(-1,2,3),s.add(e),s.add(new r.AmbientLight(11583173,.35)),w=new r.PerspectiveCamera(75,window.innerWidth/window.innerHeight,.1,50),w.position.set(1,2,4),w.far=100,w.updateProjectionMatrix(),c=new(0,a.OrbitControls)(w,l.domElement),p=new(0,o.TransformControls)(w,l.domElement),p.addEventListener("dragging-changed",(e=>{c.enabled=!e.value})),s.add(p),g=new r.Object3D,p.attach(g),s.add(g),g.position.z=.5,g.rotation.y=Math.PI/2,f=new r.PlaneHelper(b),s.add(f),m=new(0,d.TriangleSetHelper),h=new(0,d.TriangleSetHelper),u=new(0,d.TriangleSplitter),s.add(m,h),window.addEventListener("resize",(function(){w.aspect=window.innerWidth/window.innerHeight,w.updateProjectionMatrix(),l.setSize(window.innerWidth,window.innerHeight)}),!1)}(),function e(){requestAnimationFrame(e),T.set(0,0,1).transformDirection(g.matrixWorld),b.setFromNormalAndCoplanarPoint(T,g.position),u.initialize(v),x.forEach((e=>{u.splitByTriangle(e)})),f.visible=!1,p.visible=!1,p.enabled=!1,h.setTriangles(u.triangles),m.setTriangles([...v,...x]),l.render(s,w)}();
//# sourceMappingURL=triangleSplit.e0827c31.js.map