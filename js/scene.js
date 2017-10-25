var globalShips = [];
var globalModels = [];
var globalBullets = [];
var physicsfocus = 0;
var physicsHome = THREE.Vector3();
var sprites = [];
var spriteNames = ['img/Cloud1.png','img/Cloud2.png','img/Cloud3.png','img/Cloud4.png','img/Cloud5.png','img/Cloud6.png'];

var gamespeed = 5000;

var camera, controls, scene, renderer, john, jake;
var objects = [];
var selectables = [];
var projectedCameraTarget = new THREE.Vector3();
var autoCameraTarget = new THREE.Vector3();
var autoCameraPosition = new THREE.Vector3();
var autoCameraEnabled = false;
var autoTargetEnabled = false;
function physicsProto(){
	this.mass = 100;
	this.position = new THREE.Vector3(0,0,0);
	this.velocity = new THREE.Vector3(0,0,0);
	this.force = new THREE.Vector3(0,0,0);
	this.shift = new THREE.Vector3(0,0,0);
	this.doPhysicsStep = function(delta){
		var acceleration = this.force.clone().divideScalar(this.mass);
		var finalvelocity = acceleration.clone().multiplyScalar(delta).add(this.velocity);
		this.shift.copy(finalvelocity).add(this.velocity).multiplyScalar(this.delta/2);
		this.position.add(this.shift);
		this.velocity.copy(finalvelocity);
	}
}
function shipProto(sID,mID){
	this.health = 100;
	this.shipID = sID,
	this.modelID = mID,
	this.accuracy = .8,
	this.precision = 3,
	this.mass = 100,
	this.delta = .1,
	this.maxthrust = 30,
	this.orientation = new THREE.Quaternion(),
	this.center = new THREE.Vector3(0,0,0),
	this.path = [new THREE.Vector3(0,0,0)],
	this.calculateHalf = function(){
		this.velocity.multiplyScalar(.998);
		if(this.path.length<1){
			this.path.push(new THREE.Vector3(0,0,0));
		}
		var distance = this.path[0].clone().sub(this.position);
		if(this.path.length>1&&distance.length()<this.precision){
			this.path.shift();
			this.calculateHalf();
			return;
		}
		var distance = this.path[0].clone().sub(this.position);
		var rotation = new THREE.Quaternion().setFromUnitVectors(this.velocity.clone().normalize(),new THREE.Vector3(0,1,0))
		var temp = distance.clone().applyQuaternion(rotation);
		var linearforce = -(Math.pow(this.velocity.length(),2.0)*this.mass)/(2*temp.y);
		if(linearforce>this.maxthrust){
			//full retrograde burn to cancel velocity
			this.force = this.velocity.clone().normalize().multiplyScalar(-this.maxthrust);
			return;
		}
		//how much force can we dedicate to targeting
		var stoppingtime = -(this.velocity.length()*this.mass)/linearforce;
		var maxlateralforce = Math.sin(Math.acos(linearforce/this.maxthrust))*this.maxthrust;
		temp.y=0;
		var lateralforce = (2*temp.length()*this.mass)/Math.pow(stoppingtime,2.0);
		if(lateralforce>maxlateralforce){
			//
			temp.normalize().multiplyScalar(maxlateralforce);
			temp.y = linearforce;
			this.force = temp.applyQuaternion(rotation.inverse());
		}
		this.force = distance.clone().normalize().multiplyScalar(this.maxthrust);
	},
	this.jump = function(vector){
		this.position.add(vector);
		this.shift = vector.clone();
		globalModels[this.modelID].position.applyMatrix4(new THREE.Matrix4().setPosition(vector));
	},
	this.move = function(){
		//this.force = this.center.clone().sub(this.position).normalize().multiplyScalar(this.thrust);
		this.doPhysicsStep(this.delta);
		globalModels[this.modelID].position.applyMatrix4(new THREE.Matrix4().setPosition(this.shift));
	}
	this.kill = function(){
		globalShips.splice(this.shipID,1);
		scene.remove(globalModels[this.modelID]);
		globalModels[this.modelID]=0;
		return;
	}
	this.damage = function(dam){
		this.health-=dam;
		if(this.health<1){
			this.kill();
		}
	}
	}
function bulletProto(bID,mID){
	this.bulletID = bID,
	this.modelID = mID
	this.delta = .1,
	this.damage = 105;
	this.jump = function(vector){
		this.position.add(vector);
		this.shift = vector.clone();
		globalModels[this.modelID].position.applyMatrix4(new THREE.Matrix4().setPosition(vector));
	},
	this.move = function(){
		var ray = new THREE.Raycaster(this.position,this.velocity.clone().normalize(),0,this.velocity.length()*this.delta)
		var intersects = ray.intersectObjects(globalModels);
		if(intersects.length>0){
			intersects[0].object.controller.damage(this.damage);
			this.kill();
			return;
		}
		this.doPhysicsStep(this.delta);
		globalModels[this.modelID].position.applyMatrix4(new THREE.Matrix4().setPosition(this.shift));
	}
	this.kill = function(){
		globalBullets.splice(this.bulletID,1);
		scene.remove(globalModels[this.modelID]);
		globalModels[this.modelID]=0;
		return;
	}
}
var ships = [];
var navStep = 0;
var navF = 1000;
var testpath = [new THREE.Vector3(0,20,0), new THREE.Vector3(30,40,10), new THREE.Vector3(20,0,-10)];
var GLOBAL = function(){
	var geometry, material, mesh;
	
	shipProto.prototype = new physicsProto();
	shipProto.prototype.constructor=shipProto;
	bulletProto.prototype = new physicsProto();
	bulletProto.prototype.constructor=bulletProto;

	var raycaster = new THREE.Raycaster();
	var mouse = new THREE.Vector2(),
	offset = new THREE.Vector3(),
	INTERSECTED, SELECTED;

	// http://www.html5rocks.com/en/tutorials/pointerlock/intro/
	
	var prevTime = performance.now();
	var zeroTime = performance.now();

	init();
	animate();

	

	function init() {
		container = document.getElementById( "container" );

		camera = new THREE.PerspectiveCamera( 70, window.innerWidth / window.innerHeight, 1, 10000 );
		camera.position.z = 1000;

		controls = new THREE.TrackballControls( camera );
		controls.rotateSpeed = 1.0;
		controls.zoomSpeed = 1.2;
		controls.panSpeed = 0.8;
		controls.noZoom = false;
		controls.noPan = false;
		controls.staticMoving = true;
		controls.dynamicDampingFactor = 0.3;

		scene = new THREE.Scene();
		scene.fog = new THREE.Fog( 0x000000, 0, 5000 );

		var onKeyDown = function ( event ) {

			switch ( event.keyCode ) {

				case 38: // up
				case 87: // w
					moveForward = true;
					break;

				case 37: // left
				case 65: // a
					moveLeft = true; break;

				case 40: // down
				case 83: // s
					moveBackward = true;
					break;

				case 39: // right
				case 68: // d
					moveRight = true;
					break;

				case 32: // space
					if ( canJump === true ) velocity.y += 350;
					canJump = true;
					break;

			}

		};

		var onKeyUp = function ( event ) {

			switch( event.keyCode ) {

				case 38: // up
				case 87: // w
					moveForward = false;
					break;

				case 37: // left
				case 65: // a
					moveLeft = false;
					break;

				case 40: // down
				case 83: // s
					moveBackward = false;
					break;

				case 39: // right
				case 68: // d
					moveRight = false;
					break;

			}

		};

		document.addEventListener( 'keydown', onKeyDown, false );
		document.addEventListener( 'keyup', onKeyUp, false );
		
		for(var i = 0; i < spriteNames.length; i++){
			sprites.push(new THREE.TextureLoader().load(spriteNames[i]))
		}
		var galaxy_normal = randomUnit();
		var age = 0//Math.floor(Math.random()*3);
		
		galaxy = new orbitProto(30, galaxy_normal, 2, age);
		galaxy.mymu = 500000;
		galaxy.major = 16000;
		
		var theta = Math.random()*(Math.PI/2);
		var color = [Math.sin(theta)/3, 0, Math.cos(theta)/3];
		
		
		galaxy.enableEffects(color);
		galaxy.seedSystem(3, zeroTime);

		scene.add(galaxy);
		setFocus(galaxy);
		//scene.add(galaxy);
		
		
		//uncomment the following to enable camera tracking debug objects
		
		material = new THREE.MeshBasicMaterial( {color: 0xaa0000} ); //RED
		geometry = new THREE.SphereGeometry(2,8,8);
		mesh = new THREE.Mesh( geometry, material );
		//scene.add(mesh);
		
		material = new THREE.MeshBasicMaterial( {color: 0x0000aa} ); //GREEN
		geometry = new THREE.SphereGeometry(2,8,8);
		john = new THREE.Mesh( geometry, material );
		//scene.add(john);
		
		material = new THREE.MeshBasicMaterial( {color: 0x00aa00} ); //BLUE
		geometry = new THREE.SphereGeometry(2,8,8);
		jake = new THREE.Mesh( geometry, material );
		//scene.add(jake);
		
		var light = new THREE.AmbientLight( 0x202020 ); // soft white light
		scene.add( light );

		renderer = new THREE.WebGLRenderer();
		renderer.setClearColor( 0x000000 );
		renderer.setPixelRatio( window.devicePixelRatio );
		renderer.setSize( window.innerWidth, window.innerHeight );
		document.body.appendChild( renderer.domElement );

		window.addEventListener( 'resize', onWindowResize, false );
		renderer.domElement.addEventListener( 'mousemove', onDocumentMouseMove );
		renderer.domElement.addEventListener( 'mousedown', onDocumentMouseDown, false );
		renderer.domElement.addEventListener( 'mouseup', onDocumentMouseUp, false );
		renderer.domElement.addEventListener( 'mousewheel', onMouseWheel, false );
		
		if ( renderer instanceof THREE.CanvasRenderer ) {

			scene.__lights = { length: 0, push: function(){}, indexOf: function (){ return -1 }, splice: function(){} }
			scene.__objectsAdded = { length: 0, push: function(){}, indexOf: function (){ return -1 }, splice: function(){} }
			scene.__objectsRemoved = { length: 0, push: function(){}, indexOf: function (){ return -1 }, splice: function(){} }

		}

	}
	function onMouseWheel( event ) {

		event.preventDefault();

		var delta = 0;
		if ( event.wheelDelta ) {

			// WebKit / Opera / Explorer 9

			delta = event.wheelDelta / 40;

		} else if ( event.detail ) {

			// Firefox

			delta = - event.detail / 3;

		}

		//raycaster.setFromCamera( mouse, camera );
		//var intersects = raycaster.intersectObjects( selectables );


	}
	function onDocumentMouseMove( event ) {

		event.preventDefault();

		mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
		mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;

		//raycaster.setFromCamera( mouse, camera );
		//var intersects = raycaster.intersectObjects( selectables );


	}
	function onDocumentMouseDown( event ) {
		autoCameraEnabled = false;
		autoTargetEnabled = false;
		event.preventDefault();

		raycaster.setFromCamera( mouse, camera );

		var intersects = raycaster.intersectObjects( selectables );

		if ( intersects.length > 0 ) {
			controls.enabled = false;
			SELECTED = intersects[ 0 ].object;
		}
	}
	function onDocumentMouseUp( event ) {

		event.preventDefault();

		controls.enabled = true;

		if ( SELECTED ) {

			raycaster.setFromCamera( mouse, camera );
			var intersects = raycaster.intersectObjects( selectables );
			if ( intersects.length > 0 ) {
				SELECTED = intersects[ 0 ].object;
				if(physicsfocus==SELECTED){
					if(physicsfocus.parent!=null&&physicsfocus.parent!=scene){
						setFocus(SELECTED.parent);
					}
				}else{
					setFocus(SELECTED);
				}
			}

			SELECTED = null;

		}

	}

	function onWindowResize() {

		camera.aspect = window.innerWidth / window.innerHeight;
		camera.updateProjectionMatrix();

		renderer.setSize( window.innerWidth, window.innerHeight );

	}

	function animate() {

		requestAnimationFrame( animate );
		controls.update();

		var time = performance.now();
		var delta = ( time - prevTime ) / gamespeed;
		var current = time - zeroTime;
		
		// THE CLEANEST OF CLEAN CODE, AVOID ALLOCATION AS MUCH AS POSSIBLE, FLATTEN FUNCTIONS
		

		galaxy.doPhysicsStep(current);
		if(physicsfocus!=0&&physicsfocus!=galaxy){
			var adjustment = physicsfocus.realPosition().sub(galaxy.position);
			galaxy.position.x = -adjustment.x;
			galaxy.position.y = -adjustment.y;
			galaxy.position.z = -adjustment.z;
			adjustment = null;
		}else{
			galaxy.position.x = 0;
			galaxy.position.y = 0;
			galaxy.position.z = 0;
		}
		if(galaxy.particle!=0){
			galaxy.particle.rotateOnAxis(galaxy.normal,.0000005);
		}
		if(autoCameraEnabled){
			var dir = autoCameraPosition.clone().sub(camera.position);
			if(5>dir.length()){
				camera.position.x = autoCameraPosition.x;
				camera.position.y = autoCameraPosition.y;
				camera.position.z = autoCameraPosition.z;
				autoCameraEnabled = false;
			}else{
				dir.normalize().multiplyScalar(5);
				camera.position.x += dir.x;
				camera.position.y += dir.y;
				camera.position.z += dir.z;
			}
			dir = null;
		}
		if(autoTargetEnabled){
			var dir = autoCameraTarget.clone().sub(projectedCameraTarget);
			if(10>dir.length()){
				//camera.up = new THREE.Vector3(0,0,1);
				projectedCameraTarget.copy(autoCameraTarget);
				autoTargetEnabled = false;
			}else{
				dir.normalize().multiplyScalar(10);
				projectedCameraTarget.add(dir);
			}
			camera.lookAt(projectedCameraTarget);
			dir = null;
		}
		
		john.position.x = projectedCameraTarget.x;
		john.position.y = projectedCameraTarget.y;
		john.position.z = projectedCameraTarget.z;
		
		jake.position.x = autoCameraTarget.x;
		jake.position.y = autoCameraTarget.y;
		jake.position.z = autoCameraTarget.z;
		
		//CLEAN CODE END

		prevTime = time;


		renderer.render( scene, camera );
	}
}