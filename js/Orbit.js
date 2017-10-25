var randomUnit = function(ratio,goal){
	if(!ratio){
		ratio=2;
	}
	
	var Zvector = new THREE.Vector3( 0, 0, 1 );
	var Yvector = new THREE.Vector3( 0, 1, 0 );
	
	var unit = new THREE.Vector3(1,0,0);
	if(goal){
		var rotation = new THREE.Quaternion().setFromUnitVectors(unit,goal);
	}
	var lambda = (Math.random()-.5)*Math.PI;
	var phi = 4*Math.acos(ratio*Math.random()-ratio/2);
	
	unit.applyAxisAngle(Yvector, phi);
	unit.applyAxisAngle(Zvector, lambda);
	
	if(goal){
		unit.applyQuaternion(rotation);
	}
	
	return unit;
}

var distanceFunction = function(a, b){
					return Math.pow(a[0] - b[0], 2) +  Math.pow(a[1] - b[1], 2) +  Math.pow(a[2] - b[2], 2);
				};

var orbitProto = function(radius, normal, type, age){
//	//hierarchy
	this.mymu = 0;
	//this.realmom = 0;
	this.orphans = [];
	this.planettype = type;
	this.normal = normal;
	this.age = age;
	this.particle = 0;
	this.particlematerials = 0;
	this.color = [];
	
	//navigation
	this.velocity = new THREE.Vector3();
	
	//constants
	this.energy = 0; //specific_orbital_energy
	this.major  = 100; //major_semi_axis
	this.minor  = 0; //minor_semi_axis
	this.mu = 0; //
	this.eccentricity = new THREE.Vector3(); //eccentricity_vector
	this.period = 0; //time period of a single orbit
	this.initial = 0;
	this.radius = radius;
	
	//transformations
	this.xunit = new THREE.Vector3();
	this.yunit = new THREE.Vector3();
	
	//anomalys
	this.motion = 0; //mean_motion
	this.true_mod = 0; //constant mod on true_anomaly, part 3 of keplers steps
	
	if(type==0){
		//this = Object.create(THREE.Mesh.prototype);
		var material = new THREE.MeshLambertMaterial( {color: Math.floor(Math.random()*16777215)} );
		material.transparent = false;
		var geometry = new THREE.SphereGeometry(this.radius,16,16);
		this.meshSetup(geometry, material);
	}else{
		var material = new THREE.MeshBasicMaterial( {color: 0xffeeee} );
		material.transparent = true;
		material.opacity = 1;
		var geometry = new THREE.SphereGeometry(this.radius,16,16);
		this.meshSetup(geometry, material)
		var mainlight = new THREE.PointLight( 0xffeeee, type*3, 150*type );
		mainlight.ignore=true;
		this.add(mainlight);
	}
}

//Constructor/object3d setup 
orbitProto.prototype = Object.create(THREE.Mesh.prototype);
//orbitProto.prototype = Object.create(THREE.PointLight.prototype);
orbitProto.prototype.constructor = orbitProto;
orbitProto.prototype.meshSetup = function(){
	THREE.Mesh.apply(this, arguments);
}

//Physics functions
orbitProto.prototype.computeOrbit = function(velocity, relative, mu, current){
	//configures this orbit for the given vectors, returns a time(0) for the current position

	//let's first calculate a, the semi-major axis of the ellipse
	//let's use  the vis-viva equation:
	//										v^2 = mu * ( 2/r - 1/a)
	//which mutates to...
	//
	//this.major = 1/(2/relative.length() - Math.pow(velocity.length(),2.0)/mu);
	//
	//trying something new... major calculation done on energy sums
	// a = mu / 2E
	// E = v^2 / 2  -  mu / |r|
	
	if(this.debug){
		console.log(this.name);
		console.log("Velocity:");
		console.log(velocity.length());
		console.log("Distance:");
		console.log(relative.length());
		console.log("Mu:");
		console.log(mu);
	}
	this.energy = Math.pow(velocity.length(),2.0)/2 - mu / relative.length();
	if(this.debug){
		console.log("Energy:");
		console.log(this.energy);
	}
	this.major = -mu / ( 2*this.energy );
	if(this.debug){
		console.log("Major Semi-Axis:");
		console.log(this.major);
	}
	//both methods turned out to be equivalent
	//we use the second because spec (specific orbital energy) is used later as well
	



	//now let's compute e, the eccentricity vector
	// this is given by the cross product of v and h over mu, where h is the specific relative angular momentum
	//										e = (v^2 - mu/|r|)*r - dot(r,v)*v
	this.eccentricity.copy(relative).multiplyScalar(Math.pow(velocity.length(),2.0) - mu/relative.length());
	this.eccentricity.sub(velocity.clone().multiplyScalar(relative.dot(velocity))).divideScalar(mu);
	if(this.debug){
		console.log("Eccentricity:");
		console.log(this.eccentricity);
	}

	//now to compute the semi-minor axis given by:
	//													b = a*sqrt(1-|e|^2)
	// where |e| is the length of e-resize
	this.minor = this.major*Math.sqrt(1-Math.pow(this.eccentricity.length(),2.0));
	if(this.debug){
		console.log("Minor Semi-Axis:");
		console.log(this.minor);
	}
	
	//calculate the x unit vector relative to the position of the orbiting body
	//	x = eccentricity normalized
	if(this.eccentricity.length()==0){
		this.xunit.copy(relative).normalize();
	}else{
		this.xunit.copy(this.eccentricity).normalize();//.multiplyScalar(-1);
	}
	if(this.debug){
		console.log("X-Unit:");
		console.log(this.xunit);
	}

	//calculate the y unit vector relative to the position of the orbiting body
	//	y = 
	this.yunit.copy(this.xunit).cross(velocity.clone().normalize()).cross(this.xunit).normalize();;
	if(this.debug){
		console.log("Y-Unit:");
		console.log(this.yunit);
	}
	
	//we want to be able to itterate through the path in linear time with our motion going relative to speed.
	//now we've calculated the ellipse, we need to make a function that allows 
	//our angle/time to take into account the speed of areas.
	
	// mean motion n = sqrt(mu / a^3)
	
	this.motion = Math.sqrt(mu/Math.pow(this.major,3.0));
	this.period = 2*Math.PI*Math.sqrt(Math.pow(this.major,3.0)/mu);
	this.mu = mu;
	
	if(this.debug){
		console.log("Period:");
		console.log(this.period);
	}
	this.true_mod = Math.sqrt((1+this.eccentricity.length())/(1-this.eccentricity.length()));
	if(this.debug){
		console.log("True Mod:");
		console.log(this.true_mod);
	}
	//TODO: return CURRENT time position by solving for time
	//compute E from r
	var r = relative.length();
	var E = Math.acos((1 - r/this.major)/this.eccentricity.length());
	if(this.debug){
		console.log("E:");
		console.log(E);
	}
	
	//compute M from E
	var M = E - this.eccentricity.length()*Math.sin(E);
	if(this.debug){
		console.log("M:");
		console.log(M);
	}
	if(isNaN(M)){M=0;}
	
	//compute t from M
	this.initial = current - (M / this.motion);
	if(this.debug){
		console.log("Initial:");
		console.log(this.initial);
	}
	
}
orbitProto.prototype.computePosition = function(current,accuracy){
	//takes in a time and accuracy and outputs an orbiting bodies position along the orbit relative to time
	//accuracy is the number of iterations on the eccentric anomaly as per Newton's Method

	// mean anomaly M = nt
	var mean_anomaly = (( (current-this.initial)%(this.period*gamespeed) ) / gamespeed) * this.motion;
	var e = this.eccentricity.length()
	var eccentric_anomaly = 0;
	var true_anomaly = 0;
	var helio_r = 0;
	
	var x = new THREE.Vector3();
	var y = new THREE.Vector3();
	
	if( e < .001 ){
		//if the eccentricity is near zero we can assume non-anomalous behavior
		eccentric_anomaly = mean_anomaly;
		true_anomaly = mean_anomaly;
	}else{
		//otherwise...
			
		//it looks like we'll have to solve for keplers equation
		//M = E - e sin E
		//this is estimated iteratively with newton's method
		// E[n+1] = E[n] - (E[n] - e*sin(E[n]) - M(t))/(1 - e*cos(E[n])
		//where E[0]=M(t), unless e>.8, then E[0]=pi
		if( e > .8 ){
			eccentric_anomaly = Math.PI;
		}else{
			eccentric_anomaly = mean_anomaly;
		}
		
		for(var i=0;i<accuracy;i++){
			eccentric_anomaly = eccentric_anomaly - (eccentric_anomaly - e*Math.sin( eccentric_anomaly ) - mean_anomaly) / (1 - e*Math.cos( eccentric_anomaly ));
		}
		
		//now compute the true anomaly theta by:
		//tan v/2 = sqrt[(1+e)/(1-e)]*tan(E/2)
		true_anomaly = Math.atan(this.true_mod * Math.tan( eccentric_anomaly/2 )) * 2;
	}
	
	//also compute the heliocentric distance as r = major*(1 - spec*cos(eccentric_anomaly));
	helio_r = this.major * (1 - e*Math.cos(eccentric_anomaly));
	
	//we calculated a polar coordinate (r,theta) that can be applied around the central mass from the eccentricity vector
	
	x.copy(this.xunit).multiplyScalar(Math.cos(true_anomaly)*helio_r);
	y.copy(this.yunit).multiplyScalar(Math.sin(true_anomaly)*helio_r);
	
	x.add(y);
	this.position.x = x.x;
	this.position.y = x.y;
	this.position.z = x.z;
	if(this.particle!=0){
		this.particle.rotateOnAxis(this.normal,.00005);
	}
	
	x = null;
	y = null;
	
}
orbitProto.prototype.computeSpeed = function(distance){
	return Math.sqrt(this.mu*(2/distance - 1/this.major));
}
orbitProto.prototype.realPosition = function(){
	//rewrite into while loop?
	var x = this;
	var accumulated = new THREE.Vector3();
	
	while(x!=null&&x!=scene){
		accumulated.applyEuler(x.rotation);
		accumulated.add(x.position);
		x = x.parent;
	}
	x = null;
	
	return accumulated;
}

//Creation
orbitProto.prototype.generateSatellite = function(type, age, current){
	//generate stable orbit
	var range = (this.major/8)*(Math.random()+.5);
	var v = Math.sqrt(this.mymu/range);
	
	var relative = randomUnit(2-(age/1.5), this.normal).multiplyScalar(range);
	if(age>1){
		var velocity = relative.clone().normalize().cross(this.normal.clone().normalize()).multiplyScalar(v);
	}else{
		var velocity = randomUnit().multiplyScalar(v);
	}
	
	var new_satellite = new orbitProto(this.radius/4, this.normal.clone(), type, Math.floor(Math.random()*3));
	new_satellite.mymu = this.mymu / 100;
	new_satellite.computeOrbit(velocity,relative,this.mymu, current);
	var color = this.color.slice();
	color[0]+=Math.random()*.3;
	if(color[0]<0){color[0]=0;}else if(color[0]>1){color[0]=1;}
	color[2]+=Math.random()*.3;
	if(color[2]<0){color[2]=0;}else if(color[2]>1){color[2]=1;}
	new_satellite.enableEffects(color);
	this.add(new_satellite);
}
orbitProto.prototype.seedSystem = function(depth, current){
	if(depth<1){return;}
	var kids = Math.floor(Math.random()*Math.pow(4,depth)+2);
	var type = 0;
	if(depth>2){type=1;}
	for(var i=0;i<kids;i++){
		this.generateSatellite(type, this.age, current);
		this.children[this.children.length-1].seedSystem(depth-1, current);
	}
}
orbitProto.prototype.disableEffects = function(){
	if(this.particle!=0){
		this.remove(this.particle);
		this.particle = 0;
		this.particlematerials = 0;
	}
}
orbitProto.prototype.enableEffects = function(color){
	if(!color){
		if(this.color.length<3){
			var theta = Math.random()*(Math.PI/2);
			var color = [Math.sin(theta), 0, Math.cos(theta)];
			this.color = color.slice();
		}
	}else{
		this.color = color.slice();
	}
	this.disableEffects();
	var geometry = new THREE.Geometry();
	for ( i = 0; i < this.major/3; i ++ ) {
		var range = (this.major/8)*(Math.random()+.3);
		var relative = randomUnit(2-(this.age/1.5), this.normal).multiplyScalar(range);
		
		geometry.vertices.push( relative );
	}
	
	this.particlematerials = new THREE.PointsMaterial( { size: this.major/1000, map: sprites[Math.floor(Math.random()*sprites.length)], blending: THREE.AdditiveBlending, depthTest: false, transparent : true } );
	this.particlematerials.color.setRGB( this.color[0], this.color[1], this.color[2]);
	
	this.particle = new THREE.Points( geometry, this.particlematerials );
	this.particle.ignore=true;
	
	this.add(this.particle);
}


//Simulation
orbitProto.prototype.doPhysicsStep = function(delta){
	for(var i=0;i<this.children.length;i++){
		if(this.children[i].ignore||!this.children[i].visible){continue;}
		this.children[i].doPhysicsStep(delta);
		this.children[i].computePosition(delta,5);
	}
}

//Hierarchy checks and migration facilitation
orbitProto.prototype.hideMe = function(){
	this.visibility = false;
}
orbitProto.prototype.showMe = function(){
	var x = this;
	
	while(x!=null&&x!=scene){
		x.visible=true;
		x = x.parent;
	}
	x = null;
}
orbitProto.prototype.hideKids = function(){
	for(var i=0;i<this.children.length;i++){
		if(this.children[i].ignore){continue;}
		this.children[i].visible = false;
	}
}
orbitProto.prototype.showKids = function(){
	for(var i=0;i<this.children.length;i++){
		this.children[i].visible = true;
	}
}
orbitProto.prototype.showAll = function(){
	this.traverse( function ( object ) { object.visible = true; } );
}
orbitProto.prototype.hideAll = function(){
	this.traverse( function ( object ) { if(object.ignore){return;}object.visible = false; } );
}

orbitProto.prototype.debug = false;
//TODO:
//Hierarchy checks and migration facilitation:
//
// still needs transformations and arc projections
// validation doesn't exist 
// fallback calculations for non-existent arcs
// recalculation on add?

var setFocus = function(center){
	//repair connections
	console.log("P: CM, GX, CP");
	console.log(camera.position);
	console.log(galaxy.position);
	var camera_preserve = camera.position.clone().sub(galaxy.position);
	console.log(camera_preserve);
	if(physicsfocus){
		physicsfocus.hideKids();
	}
	selectables = [];
	physicsfocus = center;
	
	galaxy.hideAll();
	
	physicsfocus.showMe();
	
	selectables = [];
	selectables.push(center);
	//now manage connections
	
	if(center.parent!=null&&center.parent!=scene){
		selectables.push(center.parent);
		
		if(center.parent.parent!=null&&center.parent.parent!=scene){
			selectables.push(center.parent.parent);
		}
		
		for(var i=0;i<center.parent.children.length;i++){
			if(center.parent.children[i].ignore){continue;}
			selectables.push(center.parent.children[i]);
			center.parent.children[i].showMe();
		}
	}
	for(var i=0;i<center.children.length;i++){
		if(center.children[i].ignore){continue;}
		selectables.push(center.children[i]);
		center.children[i].showMe();
		for(var j=0;j<center.children[i].children.length;j++){
			if(center.children[i].children[j].ignore){continue;}
			selectables.push(center.children[i].children[j]);
		}
	}
	
	
	var adjustment = physicsfocus.realPosition();
	
	adjustment.x -= galaxy.position.x;
	adjustment.y -= galaxy.position.y;
	adjustment.z -= galaxy.position.z;
	adjustment.multiplyScalar(-1);
	
	galaxy.position.x = adjustment.x;
	galaxy.position.y = adjustment.y;
	galaxy.position.z = adjustment.z;
	
	camera_preserve.add(galaxy.position);
	
	projectedCameraTarget.add(camera_preserve).sub(camera.position)
	
	camera.position.x = camera_preserve.x;
	camera.position.y = camera_preserve.y;
	camera.position.z = camera_preserve.z;
	
	autoCameraTarget.x = 0;
	autoCameraTarget.y = 0;
	autoCameraTarget.z = 0;
	
	camera.lookAt(projectedCameraTarget);
	
	autoCameraPosition.copy(camera.position).normalize().multiplyScalar(physicsfocus.major/16);
	
	
	console.log("F: CM, GX, PT, CP");
	console.log(camera.position);
	console.log(galaxy.position);
	console.log(projectedCameraTarget);
	console.log(camera_preserve);
	autoCameraEnabled = true;
	autoTargetEnabled = true;
	
}


//var setFocus = function(center, depth){
//	//if the body has no children base its scale on the radius
//	//otherwise base it on the major of a child
//	var world = constructSystem(center,1);
//	scene.add(world);
//}

/*var howmany = 10;
		for(var i=0;i<howmany;i++){
			material = new THREE.MeshBasicMaterial( {color: Math.floor(Math.random()*16777215)} ); //GREEN
			geometry = new THREE.SphereGeometry(10,16,16);
			globalPlanets.push(new planetProto(globalPlanets.length,globalModels.length));
			globalPlanets[globalPlanets.length-1].velocity.add(new THREE.Vector3(Math.random()*10,Math.random()*10,Math.random()*10));
			globalPlanets[globalPlanets.length-1].position.add(new THREE.Vector3(Math.random()*10,Math.random()*10,Math.random()*10));
			globalModels.push(new THREE.Mesh( geometry, material ));
			globalModels[globalModels.length-1].controller = globalShips[globalShips.length-1];
			scene.add( globalModels[globalModels.length-1] );
			globalPlanets[globalPlanets.length-1].setup();
		}*/