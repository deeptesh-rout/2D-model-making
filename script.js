
const _masterAudio = [
    {
        'name'   : 'pop1',
        'source' : 'https://assets.codepen.io/217233/p3d_pop1_t.mp3',
        'stack' : 15
    },
    {
        'name'   : 'pop2',
        'source' : 'https://assets.codepen.io/217233/p3d_pop2_t.mp3',
        'stack' : 15
    },
    {
        'name'   : 'pop3',
        'source' : 'https://assets.codepen.io/217233/p3d_pop3_t.mp3',
        'stack' : 3
    },
    {
        'name'   : 'pop4',
        'source' : 'https://assets.codepen.io/217233/p3d_pop4_t.mp3',
    },

    {
        'name'   : 'pop5',
        'source' : 'https://assets.codepen.io/217233/p3d_pop5_t.mp3',
    },

    {
        'name'   : 'pop6',
        'source' : 'https://assets.codepen.io/217233/p3d_pop7.mp3',
    },
    {
        'name'   : 'save',
        'source' : 'https://assets.codepen.io/217233/p3d_save.wav',
    }
];

const enJin = new EnJin();

// Create audio controller
enJin.createAudioController();
enJin.audioController.load(_masterAudio);

// Voxel
// Class containing all our volxel data including its position and vertex information
// This technically represents a voxel group as well, as vue renders out a voxel for each entry in the colors array
class Voxel {
    constructor(x, y, depth, color, index) {
        this.x = x;
        this.y = y;
        this.d = depth;
        this.h = false;
        this.c = [ // Color array for each side of the voxel
            {
                0: lightenDarkenColor(color, 0),
                1: lightenDarkenColor(color, -5),
                2: lightenDarkenColor(color, -10),
                3: lightenDarkenColor(color, -15),
                4: lightenDarkenColor(color, -20),
                5: lightenDarkenColor(color, -25)
            }
        ]
        this.index = index;
    }
}

// Lighten darken any hex color by amt
function lightenDarkenColor(col, amt) {
    col = col.replace(/^#/, '')
    if (col.length === 3) col = col[0] + col[0] + col[1] + col[1] + col[2] + col[2]
    let [r, g, b] = col.match(/.{2}/g);
    ([r, g, b] = [parseInt(r, 16) + amt, parseInt(g, 16) + amt, parseInt(b, 16) + amt])
    r = Math.max(Math.min(255, r), 0).toString(16)
    g = Math.max(Math.min(255, g), 0).toString(16)
    b = Math.max(Math.min(255, b), 0).toString(16)
    const rr = (r.length < 2 ? '0' : '') + r
    const gg = (g.length < 2 ? '0' : '') + g
    const bb = (b.length < 2 ? '0' : '') + b

    return `${rr}${gg}${bb}`
}

// Rot13 function. Not critical to ser but used as a way of tracking what has been made with the tool
// If I added a unique string to this CodePen, which then passes it on to the exported pen, I could use the search to find all the models exported with this tool. The
// issue ofcourse is that the string would also exist on this pen, and so i would be supplied with all the forks. Doing it with a simple rot13 means the string will
// appear only on the exported pen.
function rot13(str) {
    var input     = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    var output    = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm';
    var index     = x => input.indexOf(x);
    var translate = x => index(x) > -1 ? output[index(x)] : x;
    return str.split('').map(translate).join('');
}

// Vue app
new Vue({
    el: '.p3d',

    data() {
        return {
            gridElement       : '.m_grid',
            voxelElement      : '.m_grid__pixel',
            canvasSize        : 17, // In voxel units
            voxels            : [],
            currentColor      : 'fff',
            currentDepth      : 1,
            mode              : 'drawing',
            drawMode          : 'draw',
            drawing           : false,
            author            : 'VoCSSels',
            zoomLevel         : .8, // Initial zoom level of our models preview
            maxZoom           : 3, // The maximum you can zoom in 
            minZoom           : .3, // The maximum you can zoom out
            orientation       : '',
            orientationButton : 'front',
            savedModels       : '',
            savedModelsMeta   : '',
            loading           : false,
            saving            : false,
            shell             : true,
            exporting         : false,
            motion            : true,
            muted             : false,
            exportSettings: {
                'name'        : 'My VoCSSel model',
                'perspective' : 3000,
                'bgColor'     : '#25273E',
                'scale'       : 1,
                'uid'         : 'madewithvocssels',
                'spinSpeed'   : 10,
                'animate'     : true,
                'x'           : 0,
                'y'           : 90,
                'z'           : 0
            },
            metaPrefix        : 'p3d_metadata_',
            modelPrefix       : 'p3d_modeldata_',
            modal             : '',
            modalOpen         : false,
            symMode           : '',
            picker: {
                'x'      : 0,
                'y'      : 0,
                'active' : false,
                'color'  : 'ffffff'
            },
            submitting       : false,
            submitted        : false,
            communityContent : []
        }
    },

    methods: {
        // Main draw function. Name is deceiving. Handles all interaction with pixels such as colour depth and shell
        // debounced
        drawPixel: _.debounce(function(event) {

            event.stopPropagation();

            let target = event.target;
            let data = $(target).data(); // Get pixel data
            let x = data.x; // Get pixel column
            let y = data.y; // Get pixel row
            let index = data.index; // Get index of pixel

            if(event.which == 3 && this.mode == "drawing") {
                this.drawMode = 'erase'
            }

            var v = _.get(this.voxels[index], 'c[0][0]', 'undefined');

            if(v != 'undefined') {
                this.picker.color = this.voxels[index].c[0][0]
            }

            // Fire when in drawing mode and not picking a colour
            if(this.mode == 'drawing' && this.drawing && !this.picker.active) {

                // Set colorpicker to current color
                $("#colorPicker").spectrum("set", this.currentColor);

                // Create a new voxel instance
                if(this.drawMode == 'draw') {

                    // If the user is currently in draw mode using draw
                    var v = _.isEmpty(this.voxels[index].c);
                    if(v) {
                        // If no voxel, make one and store in array
                        var voxel = new Voxel(x, y, 1, this.currentColor, index);   

                        // Vue set to keep reactive
                        Vue.set(this.voxels, index, voxel);

                        // Play audio
                        enJin.audioController.play('pop1');
                    } else {

                        // If the pixel we clicked on already has a voxel associated with it
                        // Firstly, set the color array to empty
                        let v = _.get(this.voxels[index], 'c', 'undefined');

                        if(v != 'undefined') {
                            this.voxels[index].h = false
                            _.omit(this.voxels[index], 'd')




                            // Generate each voxel (colour group)
                            this.generateColors(index);

                            // Only play a sound if the colour is different

                            enJin.audioController.play('pop1')
                        }

                    }
                } else {
                    // If not in draw mode, then we must be in erase mode
                    if(this.voxels[index].c != []) { // No point deleting nothing
                        // Set the voxel back to an empty array
                        Vue.set(this.voxels, index, []);

                        // Play audio
                        enJin.audioController.play('pop2');
                    }
                }
                // If we are not in drawing mode, then check if in extrude mode
            } else if(this.mode == 'extrude' && this.drawing) {

                // Check if extruding and not shelling
                if(this.drawMode == 'extrude') {

                    // Check to make sure the selected extrusion is not on a voxel that doesnt exist
                    var v = _.get(this.voxels[index], 'c', 'undefined');

                    if(v != 'undefined') {
                        // Start extrude
                        // Set the d property of the voxel to the selected depth
                        this.voxels[index].d = this.currentDepth;

                        // Reset any shell props on the voxel
                        this.voxels[index].h = false;

                        // Generate each voxel (colour group)
                        this.generateColors(index);

                        // play audio
                        enJin.audioController.play('pop2')
                    }
                } else {
                    // If not extrude, then must be hollow
                    var v = _.get(this.voxels[index], 'c', 'undefined');

                    if(v != 'undefined') {

                        // If shell is on
                        if(this.shell == true) {
                            // Check to make sure the selected extrusion is not on a voxel that doesnt exist
                            var v = _.get(this.voxels[index], 'c', 'undefined');

                            if(v != 'undefined') {
                                // set the voxels hollow prop to true
                                this.voxels[index].h = true;

                                // Get ctx
                                that = this;    

                                var length = this.voxels[index].c.length;
                                let color = this.voxels[index].c[0][0];

                                let shelledColors = [];

                                for(let i = 0; i < length; i++) {
                                    if(i == 0 || i == (length - 1)) {

                                        var s = {
                                            0: lightenDarkenColor(color, 0),
                                            1: lightenDarkenColor(color, -5),
                                            2: lightenDarkenColor(color, -10),
                                            3: lightenDarkenColor(color, -15),
                                            4: lightenDarkenColor(color, -20),
                                            5: lightenDarkenColor(color, -25)
                                        }

                                        } else {
                                            var s = '';
                                        }

                                    shelledColors.push(s)   
                                }

                                Vue.set(this.voxels[index], 'c', shelledColors);
                            }

                        } else {
                            // If shell is off
                            // Check to make sure the selected extrusion is not on a voxel that doesnt exist
                            var v = _.get(this.voxels[index], 'c', 'undefined');

                            if(v != 'undefined') {
                                // set the voxels hollow prop to false
                                this.voxels[index].h = false

                                // Generate each voxel (colour group)
                                this.generateColors(index);
                            }

                        }

                        // Play audio only if the voxel is shelled
                        if(this.voxels[index].h) {
                            enJin.audioController.play('pop4') ;
                        }
                    }
                }
            }
        }, 1),

        generateColors(voxel) {

            var v = _.get(this.voxels[voxel], 'c[0][0]', 'undefined');

            if(v != 'undefined') {

                if(this.mode == 'extrude') {
                    var color = this.voxels[voxel].c[0][0];
                } else {
                    var color = this.currentColor;
                }

                // Then set all colours to [].
                this.voxels[voxel].c = [];

                // Now create an empty object for our colours
                let newColours = [];

                // Loop through and create colours for each voxel
                for(let i = 0; i < this.currentDepth; i++) {
                    let colours = {
                        0: lightenDarkenColor(color, 0),
                        1: lightenDarkenColor(color, -5),
                        2: lightenDarkenColor(color, -10),
                        3: lightenDarkenColor(color, -15),
                        4: lightenDarkenColor(color, -20),
                        5: lightenDarkenColor(color, -25)
                    }
                    // Add colours to array
                    newColours.push(colours);
                }

                // Push this array to the voxel
                Vue.set(this.voxels[voxel], 'c', newColours);
            }
        },

        paint: _.debounce(function(event) {
            let target = event.target;
            let index = $(target).closest('.voxel-group').data().index // Get index of pixel
            let voxelIndex = $(target).parent().data().index // Get index of pixel
            let vertexIndex = $(target).data().vertex // Get index of pixel

            enJin.audioController.play('pop1');
            Vue.set(this.voxels[index].c[voxelIndex], vertexIndex, this.currentColor);
        }, 15),

        swapMode(mode) {
            this.orientation = {}
            this.zoomLevel = .8;
            this.mode = mode;

            enJin.audioController.play('pop3')
        },

        setDepth(event) {
            let target = event.target;
            let depth = $(target).data().depth;
            this.currentDepth = depth;

        },

        handleZoom(amount) {

            if(amount > 0) {
                // in
                if(this.zoomLevel < this.maxZoom) {
                    this.zoomLevel += amount;
                } else {
                    this.zoomLevel = this.maxZoom;
                }
            } else {
                // out
                if(this.zoomLevel > this.minZoom) {
                    this.zoomLevel += amount;
                } else {
                    this.zoomLevel = this.minZoom;
                }
            }
        },


        zoom(event) {
            if(this.mode != 'export') {
                const deltaY = event.deltaY;
                if(deltaY < 0) {
                    this.handleZoom(0.03);
                } else {
                    this.handleZoom(-0.03);
                }      
            }
        },

        updateOrientation(x, y, z, exp) {

            enJin.audioController.play('pop4')

            this.exportSettings.x = x;
            this.exportSettings.y = y;
            this.exportSettings.z = z;
        },

        processForExport() {

            enJin.audioController.play('pop6');
            this.exporting = true;
            var hamlArray = '- @voxels = [';

            that.voxels.forEach(function(v) {
                if(v.length != 0) {
                    let colors = '[';
                    v.c.forEach(function(c) {
                        let colourString = '{'
                        for (let key of Object.keys(c)) {
                            let col = c[key];
                            let index = key;
                            var comma;
                            if(key != 0) {
                                comma = ','
                            } else {
                                comma = ''
                            }
                            colourString = `${colourString} ${comma} ${index} => '${col}'`
                        }
                        colourString = colourString + '}'
                        colors = colors + colourString + ','
                    })
                    let haml = `{:x => ${v.x}, :y => ${v.y}, :d => ${v.d}, :c => ${colors}]},`
                    hamlArray += haml
                }
            })

            const data = {
                title : `${this.exportSettings.name} - A 3D Pure CSS & HTML Model Made With VoCSSels`,
                css : `$voxelSize: 26; // We want to work as 1 unit is 1 voxel occupying one space. So here we are setting the the amount of pixels a voxel takes. This will need to be the same as the voxel size in the vue data object.
$maxDepth: 17;
$spinSpeed: ${this.exportSettings.spinSpeed}s;
$uid: ${rot13(this.exportSettings.uid)};

// Return the true px size of a voxel based on the passed unit.
@function getVoxelSize($size, $operator) {
    @return unquote($operator + $size * $voxelSize + px);    
}

// Function to set the orientation of a side
@function setFaceOrientation($tx, $ty, $tz, $sx, $sy, $rx, $ry, $rz) {
    @return rotateX($rx + deg) rotateY($ry + deg) rotateZ($rz + deg) scaleX($sx) scaleY($sy) translate3d(unquote($tx + ',' + $ty + ',' + $tz)); 
}

%voxel {
    position: absolute;
    top: 50%;
    transform-style: preserve-3d;
    left: 0;
    right: 0;
    margin: auto;
    width: 10px;
}

%face {
    width: $voxelSize + px;
    height: $voxelSize + px;
    position: absolute;
    transform-style: preserve-3d;
    transform-origin: 50% 50%;
}

body {
    height: 100vh;
    overflow: hidden;
    background: ${this.exportSettings.bgColor};

    .p3d_playground {
        height: 100vh;
        perspective: ${this.exportSettings.perspective}px;
        transform: scale(${this.exportSettings.scale});

        .model {
            height: 100vh;
            transform-style: preserve-3d;
            ${this.exportSettings.animate ? 'animation: spin $spinSpeed infinite linear;' : ''}
            transform-origin: 50% 50% getVoxelSize($maxDepth / 2, '');
            transform: scale(.6) rotateZ(${this.exportSettings.z}deg) rotatex(${this.exportSettings.x}deg) rotateY(-${this.exportSettings.y}deg) translateY(getVoxelSize($maxDepth / 2, '-'));
            transition: all .3s;

            @media only screen and (max-width: 700px) {
               transform: scale(.5) rotateZ(${this.exportSettings.z}deg) rotatex(${this.exportSettings.x}deg) rotateY(-${this.exportSettings.y}deg) translateY(getVoxelSize($maxDepth / 2, '-'));
            }

            @keyframes spin {
                from { transform: scale(1) rotateY(0deg) rotateZ(0deg) rotatex(0deg) translateY(getVoxelSize($maxDepth / 2, '-'));}
                to { transform: scale(1) rotateY(360deg) rotateZ(0deg) rotatex(0deg) translateY(getVoxelSize($maxDepth / 2, '-'));}
            }

            .voxel,
            .voxel-group,
            .v {
                @extend %voxel;
            }

            .f {
                @extend %face;
            }

            // Utility classes
            @for $x from 0 through 20 {
                @for $y from 0 through 20 {
                    .x-#{$x}.y-#{$y} {
                        transform: translateZ(getVoxelSize($x - 0.1, '')) translateY(getVoxelSize($y - 0.1, ''));
                    }
                }
            }

            // Depths
            // This can be done on a normal loop as depth will be limited
            .f {
                @for $v from 1 through 6 {
                    &:nth-of-type(#{$v}) {
                        $operator: if($v % 2 == 0, '', '-');
                        @if $v == 1 or $v == 2 {
                            transform: setFaceOrientation(0, 0, getVoxelSize(1 / 2, $operator), 1, 1, 0, 90, 0);
                        }
                        @if $v == 3 or $v == 4 {
                            transform: setFaceOrientation(0, 0, getVoxelSize(1 / 2, $operator),1 , 1, 0, 0, 0);
                        }
                        @if $v == 5 or $v == 6 {
                            transform: setFaceOrientation(0, 0, getVoxelSize(1 / 2, $operator), 1, 1, 90, 0, 0);
                        }
                    }
                }
            }

            @for $i from 0 through 14 {
                .d-#{$i} {
                    transform: translateX(23px * $i);
                }
                .g-#{$i} {
                    transform: translateX(-23px * ($i / 2));
                }
            }
        }
    }
}`,
                css_pre_processor : "scss",
                html_pre_processor : "haml",
                html : `${hamlArray}] 
-# Created using VoCSSels by Jamie Coulter https://codepen.io/jcoulterdesign/pen/vYyzZdo
.p3d_playground
    .model
        - @voxels.each do | voxel |
            .voxel-group{:class => "g-#{voxel[:d]}"}
                -(1..voxel[:d]).each do | index |
                    .voxel{:class => "d-#{index}"}
                        .v{:class => "x-#{voxel[:x]} y-#{voxel[:y]}"}
                            -(1..6).each do | v |
                                .f.f--t{:style => "background-color: ##{voxel[:c][index - 1][v]}"}`
            };

            const JSONstring = JSON.stringify(data).replace(/"/g, "&quot;").replace(/'/g, "&apos;");
            const form = `<form class="export" action="https://codepen.io/pen/define" method="POST" target="_blank"><input class="change" type="hidden" name="data" value='${JSONstring}'><input type="submit" width="40" height="40" value="Export to new pen"></form>`;
            $('.editor_right__export .form').html('');
            $('.editor_right__export .form').append(form);
            that = this;
            setTimeout(function() {
                that.exporting = false;
                $('.export').submit();
            }, 1500)

        },

        /* -------------------------------------------------------------------------

        Save model to local storage

        ------------------------------------------------------------------------- */

        save() {
            // Work out todays date
            let today = new Date();
            let dd = String(today.getDate()).padStart(2, '0');
            let mm = String(today.getMonth() + 1).padStart(2, '0');
            let yyyy = today.getFullYear();

            let date = mm + '.' + dd + '.' + yyyy;

            // Save model to local storage
            // Start by creating a metadata object for our models information
            let metaData = {
                'date'     : date,
                'author'   : this.author,
                'name'     : this.exportSettings.name,      // Get the model name
                'voxels'   : $('.v').length, // Get the total voxels in the model
                'vertices' : $('.f').length, // Get the total vertices in the model
                'image'    : '',             // Set a blank string for the base64 image data
                'bgColor'  : this.exportSettings.bgColor
            }

            // Set a new item in local storage for the model data and assing the JSON to it
            window.localStorage.setItem(this.modelPrefix + this.exportSettings.name.toLowerCase().replace(/\s/g, ''), JSON.stringify(this.voxels));

            // Set saving flag to show saving icon
            this.saving = !this.saving;

            // Reset the zoom level for the snap shot
            this.zoomLevel = 0.8;

            // Take snapshop of model node
            const node = document.getElementById('model');

            // Hide preview buttons
            $('.zooms').hide();

            domtoimage.toPng(node)
                .then(function (dataUrl) {

                var that = this; // Get context
                var img = new Image(); 

                // Set image in meta data to data url
                metaData.image = dataUrl; 

                // Set local storage item to metadata
                window.localStorage.setItem(that.metaPrefix + that.exportSettings.name.toLowerCase().replace(/\s/g, ''), JSON.stringify(metaData));



                // Set saving flag back to false after a reasonable delay
                setTimeout(function() {
                    // Show preview buttons
                    $('.zooms').show();

                    // Reset saving flag
                    that.saving = !that.saving;

                    // Update the saved models arrays so they are accessible in the modal straight away
                    that.getSavedModels();

                    // Play sound feedback
                    enJin.audioController.play('save')
                }, 1000)

            }.bind(this)); 
        },

        handleRightClick() {

            if(this.drawMode == 'erase') {
                this.drawMode = 'draw'
            }  

        },
        shareModel() {
            // Work out todays date
            let today = new Date();
            let dd = String(today.getDate()).padStart(2, '0');
            let mm = String(today.getMonth() + 1).padStart(2, '0');
            let yyyy = today.getFullYear();

            let date = mm + '.' + dd + '.' + yyyy;

            let metaData = {
                'date'     : date,
                'author'   : this.author,
                'name'     : this.exportSettings.name,      // Get the model name
                'voxels'   : $('.v').length, // Get the total voxels in the model
                'vertices' : $('.f').length, // Get the total vertices in the model
                'image'    : '',             // Set a blank string for the base64 image data
                'bgColor'  : this.exportSettings.bgColor
            }

            metaData.modelData = [this.voxels];

            // Reset the zoom level for the snap shot
            this.zoomLevel = 0.8;

            // Take snapshop of model node
            const node = document.getElementById('model');

            // Hide preview buttons
            $('.zooms').hide();

            this.submitting = !this.submitting;

            domtoimage.toPng(node)
                .then(function (dataUrl) {

                var that = this; // Get context
                var img = new Image(); 

                // Set image in meta data to data url
                metaData.image = dataUrl; 

                // Set local storage item to metadata
                window.localStorage.setItem(that.metaPrefix + that.exportSettings.name.toLowerCase().replace(/\s/g, ''), JSON.stringify(metaData));
                if(that.submitting == false) {
                    // Set saving flag back to false after a reasonable delay
                    setTimeout(function() {
                        // Show preview buttons
                        $('.zooms').show();

                        // Post data to zapier webhook
                        var xhr = new XMLHttpRequest();
                        xhr.open("POST", 'https://hooks.zapier.com/hooks/catch/708069/onctccu', true);
                        xhr.send(JSON.stringify(metaData));



                        setTimeout(function() {
                            that.submitted = true;
                            that.submitting = false;
                            enJin.audioController.play('save')
                        }, 2000)
                    }, 1000)
                }

            }.bind(this));


        },
        /* -------------------------------------------------------------------------

        Get models from local storage

        ------------------------------------------------------------------------- */

        getSavedModels() {

            // First, clear any data from the saved models and meta arrays
            let savedModels = [];
            let savedModelsMeta = [];

            // Iterate over localStorage and insert the keys that meet the condition into arr
            for (let i = 0; i < window.localStorage.length; i++) {
                // Check for p3d_modeldata prefix
                if (window.localStorage.key(i).substring(0, this.modelPrefix.length) == this.modelPrefix) {
                    savedModels.push(window.localStorage.key(i));
                }
                // Check for p3d_modeldata prefix
                if (window.localStorage.key(i).substring(0, this.metaPrefix.length) == this.metaPrefix) {
                    savedModelsMeta.push(window.localStorage.key(i));
                }
            }

            // Set the arrays to the model data and meta keys. This will then update vue loop in the load modal
            let meta = savedModelsMeta.sort();
            let data = savedModels.sort();

            this.savedModelsMeta = meta;
            this.savedModels = data;
        },

        /* -------------------------------------------------------------------------

        Get meta data entry for saved model

        ------------------------------------------------------------------------- */

        getMetaData(key, index) {
            let data = JSON.parse(window.localStorage.getItem(index));
            let metaData = data[key];
            return metaData;
        },

        /* -------------------------------------------------------------------------

        Load model from local storage

        ------------------------------------------------------------------------- */

        load(model, community) {

            if(!community) {

                var target = this.savedModels[model];
                var metaTarget = this.savedModelsMeta[model];

                var modelData = window.localStorage.getItem(target);
                var metaData = JSON.parse(window.localStorage.getItem(metaTarget));


            } else {
                var metaData = model
                var modelData = model.modelData[0];
            }




            // Remove all voxel information
            this.voxels = [];
            this.exportSettings.name = metaData.name;
            this.mode = 'drawing';

            // Re get context
            that = this;
            this.loading = !this.loading;

            setTimeout(function() {

                $("#colorBg, #exportBg").spectrum("set", metaData.bgColor);
                that.exportSettings.bgColor = metaData.bgColor;

                if(!community) {
                    that.voxels = JSON.parse(modelData);
                } else {
                    that.voxels = modelData;
                }

                that.loading = !that.loading;
            }, 1000)
        },

        newModel() {
            this.voxels = [];
            this.mode = 'drawing';
            $("#colorBg, #exportBg").spectrum("set", '#25273E');
            $("#colorPicker").spectrum("set", '#ffffff');
            that.exportSettings.bgColor = '#25273E';

            for(let i = 0; i < Math.pow(this.canvasSize, 2); i++) {
                this.voxels.push([]);
            }
        },

        /* -------------------------------------------------------------------------

        Open modal

        ------------------------------------------------------------------------- */

        openModal(modal) {
            this.modalOpen = true;
            this.modal = modal;
        },

        /* -------------------------------------------------------------------------

        Close modals

        ------------------------------------------------------------------------- */

        closeModals() {
            this.modalOpen = false;


            this.modal = '';
            that = this;

            setTimeout(function() {
                that.submitted = false;
            }, 1000)
        },

        /* -------------------------------------------------------------------------

        Open modal

        ------------------------------------------------------------------------- */

        colorPicker(event) {
            this.picker.x = event.clientX;
            this.picker.y = event.clientY;
        },

        selectColor: _.debounce(function() {
            if(this.picker.active) {
                this.picker.active = !this.picker.active;
                this.currentColor = this.picker.color;
                $("#colorPicker").spectrum("set", this.picker.color);
            }
        }, 10),

        /* -------------------------------------------------------------------------

        Reset all of the colour pickers to their default values

        ------------------------------------------------------------------------- */

        getVoxelsCount(model) {
            return $('.v').length;
        },

        /* -------------------------------------------------------------------------

        Reset all of the colour pickers to their default values

        ------------------------------------------------------------------------- */

        getVerticesCount(model) {
            return $('.f').length;
        },

        /* -------------------------------------------------------------------------

        Reset all of the colour pickers to their default values

        ------------------------------------------------------------------------- */

        resetBgColor() {
            $("#colorBg, #exportBg").spectrum("set", '#25273E');
            this.exportSettings.bgColor = '#25273E';
        },

        /* -------------------------------------------------------------------------

        Get all community models from GitHub gists

        ------------------------------------------------------------------------- */

        getCommunityModels() {
            let xhr = new XMLHttpRequest();

            xhr.open('GET', 'https://api.github.com/users/jcoulterdesign/gists');
            xhr.send();

            // Store contenxt
            that = this;

            xhr.onload = function() {
                if (xhr.status == 200) { 
                    let gists = JSON.parse(xhr.response);
                    let urls = []; // Raw urls array

                    gists.forEach(function(g) {
                        let files = g.files;

                        for (let key of Object.keys(files)) {
                            let raw_url = files[key].raw_url;
                            urls.push(raw_url);
                        }
                    })

                    // Now we have a list of all approved gists. Loop through and get the content of each one and
                    // store to our vue instance

                    var xhrReq = [];

                    urls.forEach(function(u, i) {
                        xhrReq[i] = new XMLHttpRequest();
                        xhrReq[i].open('GET', u);
                        xhrReq[i].send();

                        ctx = that;
                        xhrReq[i].onload = function() {
                            if (xhrReq[i].status == 200) {
                                ctx.communityContent.push(JSON.parse(xhrReq[i].response));
                            }
                        }
                    })

                    $('.community .x-wrap').width(urls.length * 265 + 'px')
                }
            };
        },

        /* -------------------------------------------------------------------------

        Delete model from local storage

        ------------------------------------------------------------------------- */

        deleteModel(model) {
            // Get the relevant entry in storage
            let target = this.savedModels[model];
            let targetMeta = this.savedModelsMeta[model];

            // Remove both the meta and the model data
            window.localStorage.removeItem(target);
            window.localStorage.removeItem(targetMeta);

            // Update the UI by updating models array
            this.getSavedModels();
        },

        /* -------------------------------------------------------------------------

        Toggle the audio controller muted prop

        ------------------------------------------------------------------------- */

        toggleAudio() {
            enJin.audioController.play('pop6');
            enJin.audioController.muted = !enJin.audioController.muted;
            this.muted = !this.muted
        },

        /* -------------------------------------------------------------------------

        Quick and dirty way to reduce motion in the app. Add a class to everything that
        has transition-duration 0

        ------------------------------------------------------------------------- */

        toggleMotion() {
            enJin.audioController.play('pop6');
            this.motion = !this.motion;
            if(this.motion) {
                $('*').removeClass('noMotion');
            } else {
                $('*').addClass('noMotion');
            }
        }
    },

    mounted() {

        // Get all the community VoCSSels for github gists
        this.getCommunityModels();

        // Get all saved models from local storage
        this.getSavedModels();

        // Prepare an empty voxels array
        for(let i = 0; i < Math.pow(this.canvasSize, 2); i++) {
            this.voxels.push([]);
        }

        /* -------------------------------------------------------------------------

        Set up our spectrums

        ------------------------------------------------------------------------- */

        // Main colour selector
        $("#colorPicker").spectrum({
            color: "ffffff",
            preferredFormat: "hex",
            flat: true,
            showInput: true,
            showPalette: true,
            palette: [],
            showSelectionPalette: true, // true by default
            selectionPalette: [],
            clickoutFiresChange: true,
            maxSelectionSize: 15,
            move(color) {
                that.currentColor = color.toHexString().substring(1); // #ff0000

            }
        });

        // Auto switch to draw when selecting a colour
        $('#colorPicker').on("dragstart.spectrum", function(e, color) {
            that.drawMode = 'draw'
        });

        // Auto switch to draw when selecting a colour
        $('#colorPicker').on("move.spectrum", function(e, color) {
            that.drawMode = 'draw'
        });

        // Background color selectors for preview panel and export
        $("#colorBg, #exportBg").spectrum({
            color: "25273E",
            containerClassName: 'bg',
            move(color) {
                that.bgColor = color.toHexString(); // #ff0000
                that.exportSettings.bgColor = color.toHexString();
                $("#colorBg, #exportBg").spectrum("set", color.toHexString());
            }
        });

        // Make sure the first palette entry is selected
        $('.sp-thumb-inner').click();

        // Simple preloader
        setTimeout(function() {
            $('.p3d_loader').fadeOut();
        }, 4000)
    }
});

// Symmetry
// Fix intermittent bug
// Optimize




/*
    Dependencies
    https://codepen.io/jcoulterdesign/pen/1e3ed378fed68f1a43bc4f73f9964945
    https://codepen.io/jcoulterdesign/pen/6c44bfdc74442457826e062bc719c586
    https://cdnjs.cloudflare.com/ajax/libs/jquery/3.5.1/jquery.min.js
    https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.11/vue.min.js
    https://cdnjs.cloudflare.com/ajax/libs/spectrum/1.8.1/spectrum.js
    https://cdnjs.cloudflare.com/ajax/libs/dom-to-image/2.6.0/dom-to-image.min.js
*/

// Master audio array. This is for audio that will not be manipulated by any HTML5 filters.
// For audio needing low, high pass effects, add them to the _specialAudio array.