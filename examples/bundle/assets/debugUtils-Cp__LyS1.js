function o(...e){function i(n){return`new THREE.Vector3( ${n.x}, ${n.y}, ${n.z} )`}return e.map(n=>`
new THREE.Triangle(
	${i(n.a)},
	${i(n.b)},
	${i(n.c)},
)
		`.trim())}function r(...e){console.log(o(...e).join(`,
`))}export{r as l};
