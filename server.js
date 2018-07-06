var express = require('express');
var ebml = require('ebml');
var bodyParser = require("body-parser");
var ffmpeg = require('fluent-ffmpeg');
var Blob = require('blob');
var fs = require('fs');
var app = express();
var util = require('util');
var ChildProcess = require('child_process');
var FileReader = require('filereader');
const path = require('path');
formidable = require('formidable');

var basePath = "./record/";
var prev_path;
var folderName;
var new_folder;

var audioIndex;
var videoIndex;
var dataIndex;
var flag;
// var arrayOfBlobs;

app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
app.use(bodyParser.json({limit: '50mb'}));
app.use(bodyParser.raw({limit: '50mb'}));
app.use( (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

app.get('/begin', (req, res) => {
	console.log('Begin');
	finalData = '';
	prev_path = '';
    folderName = (new Date).toISOString().replace(/:|\./g, '');
	new_folder = new_folder = path.join(process.env.PWD, basePath, folderName);
	fs.mkdirSync(new_folder);
	fs.mkdirSync(new_folder + '/tmp');
	videoIndex = audioIndex = 0;
    dataIndex = 0;
	flag = true;
    // arrayOfBlobs = [];
	res.send('BEGIN');
});

app.post('/data-new-blob', (req, res) => {
    dataIndex++;
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        
    });
});

app.post('/data-audio', (req, res) => {
	if(!flag){
		res.status(200);
        res.json({'success': false});
        return;
    }

	var form = new formidable.IncomingForm();
	form.parse(req, function(err, fields, files) {
		console.log('parse');
        // `file` is the name of the <input> field of type `file`
        var old_path = files.file.path,
            file_size = files.file.size,
            file_ext = files.file.name.split('.').pop(),
            datatype = files.file.datatype;
            index = old_path.lastIndexOf('/') + 1,
            file_name = old_path.substr(index);
        var new_path = path.join(new_folder, 'audio-' + audioIndex++ + '.' + file_ext);

        fs.readFile(old_path, function(err, data) {
            fs.writeFile(new_path, data, function(err) {
                fs.unlink(old_path, function(err) {
                    if (err) {
                        res.status(500);
                        res.json({'success': false});
                    } else {
                        res.status(200);
                        res.json({'success': true});
                    }
                });
            });
        });
    });

    


	// let filename = "particle_" + index + ".ts";
	// let path = basePath + filename;
	// //console.log(util.inspect(req.body));
	// fs.writeFileSync(path, util.inspect(req.body), 'utf-8');
	// fs.writeFileSync(path, req, 'utf-8');
	
	// console.log("File " + path + " successfully saved.");
	// finalData += "file '" + filename + "'\n";

	// index++;
	// res.send('POST request');
});

app.post('/data-video', (req, res) => {
    if(!flag){
        res.status(200);
        res.json({'success': false});
        return;
    }

    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
        console.log('parse');
        console.log(fields);
        // `file` is the name of the <input> field of type `file`
        var old_path = files.file.path,
            file_size = files.file.size,
            file_ext = files.file.name.split('.').pop(),
            datatype = files.file.datatype;
            index = old_path.lastIndexOf('/') + 1,
            file_name = old_path.substr(index);
        var new_path = path.join(new_folder, 'video-' + videoIndex++ + '.' + file_ext);

        fs.readFile(old_path, function(err, data) {
            fs.writeFile(new_path, data, function(err) {
                fs.unlink(old_path, function(err) {
                    if (err) {
                        res.status(500);
                        res.json({'success': false});
                    } else {
                        res.status(200);
                        res.json({'success': true});
                    }
                });
            });
        });
    });
});

app.get('/end', (req, res) => {
	console.log('Got ENDING signal, waiting for rest of blobs to arrive...');
	flag = false;
	setTimeout(function() {
		writeAll();
        //finalBlob();
	}, 1000);
	res.send('END');
});

function writeAll(){
    console.log('Writing into output files...');
    mergeVideo();
}

//Сшиваем видео-блобы
function mergeVideo(){
    let cmd = 'mkvmerge -o ./record/' + folderName + '/all-video.webm -w';
    for(let i = 0; i < videoIndex ; i++){
        if(i != 0) cmd += ' +';
        cmd += ' ./record/' + folderName + '/video-' + i + '.blob';
    }
    console.log(cmd);
    ChildProcess.exec(cmd, (err, stdout, stderr) => {
        if(err){
            console.log(err);
            return;
        }
        console.log(stdout);
        mergeAudio();
    });
}

//Сшиваем аудио-блобы
function mergeAudio(){
    cmd = 'mkvmerge -o ./record/' + folderName + '/all-audio.ogg -w';
    for(let i = 0; i < audioIndex ; i++){
        if(i != 0) cmd += ' +';
        cmd += ' ./record/' + folderName + '/audio-' + i + '.blob';
    }
    console.log(cmd);
    ChildProcess.exec(cmd, (err, stdout, stderr) => {
        if(err){
            console.log(err);
            return;
        }
        console.log(stdout);
        finalizeVideo();
    });
}

//Синхронизируем видео и аудио, получаем на выходе окончательный файл
function finalizeVideo(){
    cleanDirectory();
    let cmd = 'ffmpeg -i ./record/' + folderName + '/all-video.webm -i ./record/' + folderName + '/all-audio.ogg -c copy ./record/' + folderName + '/output.webm'; 
    console.log(cmd);
    ChildProcess.exec(cmd, (err, stdout, stderr) => {
        console.log(stdout);
    });
}

//Очищаем директорию записи от уже невостребованных блобов
function cleanDirectory(){
    let _path = './record/' + folderName;
    fs.readdir(_path, (err, files) => {
        files.forEach( (file) => {
            if(file.split('.')[1] === 'blob'){
                fs.unlink('./record/' + folderName + '/' + file, (err) => {
                    if(err) throw err;
                    console.log('./record/' + folderName + '/' + file + ' was successfully deleted');
                })
            }
        })
    });
}
  
app.listen(5000, () => {
	console.log("HTTP server listening on port 5000");
});