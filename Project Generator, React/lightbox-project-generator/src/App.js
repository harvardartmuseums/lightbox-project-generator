import React, { Component } from 'react';
import {Editor, EditorState, ContentState, RichUtils} from 'draft-js';
import {stateToHTML} from 'draft-js-export-html';
import {stateFromHTML} from 'draft-js-import-html';

var dataPoints = ["speechSynthesis", "progressBar", "remoteInstructions", "translations", "transitions"];

var reader = new FileReader();

var panel = false;
var move = false;

function reverseOverlayLocation(row, col) {
	var ret;
	switch (row) {
		case "top":
			ret = 0;
			break;
		case "middle":
			ret = 3;
			break;
		case "bottom":
			ret = 6;
			break;
	}
	switch (col) {
		case "left":
			ret += 0;
			break;
		case "center":
			ret += 1;
			break;
		case "right":
			ret += 2;
			break;
	}
	return ret;
}

function overlayLocation(i) {
	var ret = "\"";
	switch (Math.floor(i/3)) {
		case 0:
			ret += "top";
			break;
		case 1:
			ret += "middle";
			break;
		case 2:
			ret += "bottom";
			break;
	}
	ret += "\", \"";
	switch (i%3) {
		case 0:
			ret += "left";
			break;
		case 1:
			ret += "center";
			break;
		case 2:
			ret += "right";
			break;
	}
	ret += "\", ";
	return ret;
}

function Language(displayName, tag="en-US") {
	this.displayName = displayName;
	this.tag = tag;
}

class LanguageSelector extends Component {
	constructor(props) {
		super(props);
		
		this.input = this.input.bind(this);
		this.remove = this.remove.bind(this);
	}

	input() {
		this.props.input(document.getElementById("languageDropDown").selectedIndex);
	}

	remove() {
		this.props.remove(document.getElementById("languageDropDown").selectedIndex);
	}

	

	render() {
		return(
			<div className="languageSelector">
				<select name="language" onChange={this.input} id="languageDropDown" value={this.props.currentLanguage}>
					{this.props.languages.map(function(language) {
						return <option value={language.displayName} key={language.tag + language.displayName}>{language.displayName}</option>;
					}, this)}
				</select><br /><br />
				<span onClick={this.props.edit}>Add</span>
				{(this.props.languages.length > 1)? <span onClick={this.remove}>Remove</span> : ""}
			</div>
		);
	}
}

class LanguageEditor extends Component {
	constructor(props) {
		super(props);

		this.add = this.add.bind(this);
	}

	add() {
		if (document.getElementById("languageAddDisplayName").value != "") {
			if (/[A-z]{2}-[A-z]{2}/.test(document.getElementById("languageAddTag").value)) {
				this.props.add(document.getElementById("languageAddDisplayName").value, document.getElementById("languageAddTag").value);
			} else {
				this.props.add(document.getElementById("languageAddDisplayName").value);
			}
		} else {
			alert("Please enter a display name for this language.");
		}
	}

	render() {
		return (
			<div className="languageEditor">
				<span>Type the display name and four-character IETF tag in the spaces below (for example, <em>American English&nbsp;&nbsp;&nbsp;&nbsp;en-US</em>).<br /><br />You may leave the IETF tag blank, in which case speech synthesis pronunciation will default to an American English accent.</span>
				<input type="text" id="languageAddDisplayName" />
				<input type="text" id="languageAddTag" />
				<div className="enterButton" onClick={this.add}>Add</div>
				<div className="cancelButton" onClick={this.props.cancel}>Cancel</div>
			</div>
		);
	}
}

function ScreenDimmer(props) {
	return(
		<div className="screenDimmer" />
	);
}

const BLOCK_TYPES = [
	{label: 'Slide Titles', style: 'header-one', icon: <h1>Tt</h1>},
	{label: 'Object Titles', style: 'header-four', icon: <h4>Tt</h4>},
	{label: 'Object Captions', style: 'header-five', icon: <h5>Tt</h5>}
];

const INLINE_STYLES = [
	{label: 'Italic', style: 'ITALIC', icon: <em>Tt</em>}
];


function Styles(props) {
	var currentStyle = props.editorState.getCurrentInlineStyle();
	var selection = props.editorState.getSelection();
	var blockType = props.editorState.getCurrentContent().getBlockForKey(selection.getStartKey()).getType();

	return (
		<div className={props.className}>
			{BLOCK_TYPES.map(type =>
				<StyleButton key={type.label} active={type.style === blockType} label={type.label} onToggle={props.onBlockToggle} style={type.style}>{type.icon}</StyleButton>
			)}
			{INLINE_STYLES.map(type =>
				<StyleButton key={type.label} active={currentStyle.has(type.style)} label={type.label} onToggle={props.onInlineToggle} style={type.style}>{type.icon}</StyleButton>
			)}
		</div>
	);
}

class StyleButton extends Component {
	constructor(props) {
		super(props);

		this.onToggle = (e) => {
			e.preventDefault();
			this.props.onToggle(this.props.style);
		};
	}

	render() {
		return (
			<span className={"styleButton" + (this.props.active? " active" : "")} onMouseDown={this.onToggle}>
				{this.props.label}<br />
				{this.props.children}
			</span>
		);
	}
}

class TextEditor extends Component {
	constructor(props) {
		super(props);

		this.state = {
			editorState: ((this.props.panel.content[this.props.language] != undefined) && !(this.props.panel.image))? EditorState.createWithContent(this.props.panel.content[this.props.language]) : EditorState.createEmpty(),
			padding: this.props.panel.padding,
			image: this.props.panel.image
		};

		this.focus = () => this.refs.editor.focus();
		this.onChange = (editorState) => this.setState({editorState});

		this.handleKeyCommand = (command) => this._handleKeyCommand(command);
		this.onTab = (e) => this._onTab(e);
		this.toggleBlockType = (type) => this._toggleBlockType(type);
		this.toggleInlineStyle = (style) => this._toggleInlineStyle(style);

		this.togglePadding = this.togglePadding.bind(this);
		this.toggleImage = this.toggleImage.bind(this);
		this.align = this.align.bind(this);
		this.valign = this.valign.bind(this);
		this.save = this.save.bind(this);
		this.saveImage = this.saveImage.bind(this);
	}

	_handleKeyCommand(command) {
		var newState = RichUtils.handleKeyCommand(this.state.editorState, command);
		if (newState) {
			this.onChange(newState);
			return true;
		} else {
			return false;
		}
	}

	_onTab(e) {
		const maxDepth = 4;
		this.onChange(RichUtils.onTab(e, this.state.editorState, maxDepth));
	}

	_toggleBlockType(blockType) {
		this.onChange(
			RichUtils.toggleBlockType(this.state.editorState, blockType)
		);
	}

	_toggleInlineStyle(inlineStyle) {
		this.onChange(
			RichUtils.toggleInlineStyle(this.state.editorState, inlineStyle)
		);
	}

	save() {
		this.props.save(this.state.editorState.getCurrentContent());
	}

	saveImage() {
		if (document.getElementById("imageUpload").files[0]) {
			this.props.save(document.getElementById("imageUpload").files[0].name, "notLoaded");
	
			reader.addEventListener("load", function(src) {
				this.props.save(src, reader.result);
			}.bind(this, document.getElementById("imageUpload").files[0].name), false);

			reader.readAsDataURL(document.getElementById("imageUpload").files[0]);
		} else {
			alert("Please upload an image!");
		}
	}

	togglePadding() {
		this.setState(function(prevState, props) {
			this.props.edit("padding", !prevState.padding);
			return {padding: !prevState.padding};
		});
	}

	toggleImage() {
		this.setState(function(prevState, props) {
			this.props.edit("image", !prevState.image);
			return {image: !prevState.image};
		});
	}

	align(option) {
		this.props.edit("align", option);
	}

	valign(option) {
		this.props.edit("valign", option);
	}

	render() {
		return(
			<span>
			{this.state.image?
			<div className="textEditor">
				<div className="toggleImage" onClick={this.toggleImage}>Enter text</div>
				<div className="imageUploader">
					Select an image file. Be sure to store in the same data folder of the Lightbox project you produce with this tool.<br /><br />
					<input type="file" accept="image/*" id="imageUpload" />
				</div>
				<div className="options">
					<div onClick={this.togglePadding}>
					Padding
						<label className="switch">
							<input type="checkbox" checked={this.state.padding} onClick={this.togglePadding} />
							<div className="slider"></div>
						</label>
					</div>
				</div>
				<div className="cancelButton" onClick={this.props.cancel}>Cancel</div>
				<div className="enterButton" onClick={this.saveImage}>Save</div>
				</div>
				:
				<div className="textEditor">
					<div className="toggleImage" onClick={this.toggleImage}>Enter image</div>
				<Styles className="textFormats" editorState={this.state.editorState} onBlockToggle={this.toggleBlockType} onInlineToggle={this.toggleInlineStyle} />
				<div className="textBody" onClick={this.focus}>
					<Editor editorState={this.state.editorState} handleKeyCommand={this.handleKeyCommand} onChange={this.onChange} onTab={this.onTab} ref="editor" spellCheck={true} stripPastedStyles={true} />
				</div>
				<div className="options">
					<div onClick={this.togglePadding}>
					Padding
						<label className="switch">
							<input type="checkbox" checked={this.state.padding} onClick={this.togglePadding} />
							<div className="slider"></div>
						</label>
					</div><br /><br /><br />
					<div>Alignment<br /><br />
					<fieldgroup className="threePointSwitch">
						<input type="radio" name="align" value="left" checked={(this.props.panel.align == "left")} className="top" /><span onClick={this.align.bind(this, "left")}>Left</span>
						<input type="radio" name="align" value="center" checked={(this.props.panel.align == "center")} className="middle" /><span onClick={this.align.bind(this, "center")}>Center</span>
						<input type="radio" name="align" value="right" checked={(this.props.panel.align == "right")} className="bottom" /><span onClick={this.align.bind(this, "right")}>Right</span>
						<div className="slider"></div>
					</fieldgroup>
					</div><br /><br /><br />
					<div>Vertical Alignment<br /><br />
					<fieldgroup className="threePointSwitch">
						<input type="radio" name="valign" value="top" checked={(this.props.panel.valign == "top")} className="top" /><span onClick={this.valign.bind(this, "top")}>Top</span>
						<input type="radio" name="valign" value="middle" checked={(this.props.panel.valign == "middle")} className="middle" /><span onClick={this.valign.bind(this, "middle")}>Middle</span>
						<input type="radio" name="valign" value="bottom" checked={(this.props.panel.valign == "bottom")} className="bottom" /><span onClick={this.valign.bind(this, "bottom")}>Bottom</span>
						<div className="slider"></div>
					</fieldgroup>
					</div>
				</div>
				<div className="cancelButton" onClick={this.props.cancel}>Cancel</div>
				<div className="enterButton" onClick={this.save}>Save</div>
			</div>
			}
			</span>
		);
	}
}

function BackgroundColorMenu(props) {
	return(
		<div className="backgroundMenu">
			<div className="dark backgroundOption" onClick={props.change.bind(null, "dark", props.panel)} />
			<div className="light backgroundOption" onClick={props.change.bind(null, "light", props.panel)} />
			{props.overlay? <div className="transparent backgroundOption" onClick={props.change.bind(null, "transparent", props.panel)} /> : ""}
		</div>
	);
}

class Panel extends Component {
	constructor(props) {
		super(props);

		this.edit = this.edit.bind(this);
		this.drag = this.drag.bind(this);
		this.allowDrop = this.allowDrop.bind(this);
		this.drop = this.drop.bind(this);
	}

	edit() {
		if (this.props.edit != undefined) {
			this.props.edit(this);
		}
	}

	allowDrop(e) {
		this.props.allowDrop(e);
	}

	drop(e) {
		this.props.drop(e);
	}

	drag(e) {
		e.dataTransfer.setData("text/plain", e.target.id);
		panel = true;
		move = this.props.move;
	}

	render() {
		var scale = (window.innerHeight*.8 - window.innerWidth*.08 - 4)/3240;
		var style = {
			backgroundImage: 'url(grid.png)',
			backgroundSize: '5760px 3240px'
		};
		return(
			<div className={"panel " + this.props.shape + " " + this.props.background + " " + this.props.valign + " " + this.props.align + (this.props.padding? " padded" : "") + (this.props.overlay? " overlay s" + this.props.location : "")} onDragStart={(this.props.overlay? function() {} : this.drag)} onDragOver={(this.props.overlay? function() {} : this.allowDrop)} onDrop={(this.props.overlay? function() {} : this.drop)} draggable={(this.props.overlay? false : this.props.draggable)} id={this.props.id} style={style} onDoubleClick={this.edit}>
				{(this.props.image)? <img src={this.props.imagePreview} alt={"User uploaded image"} /> : <Editor editorState={(this.props.content != undefined)? EditorState.createWithContent(this.props.content) : EditorState.createEmpty()} className="panelContents" readOnly={true} />}
				{this.props.children}
			</div>
		);
	}
}

function ProgressBar(props) {
	return (
		<div className="progressBar" style={{width: props.percent + "%"}} />
	);
}

function RemoteInstructions(props) {
	return (
		<div className="remoteInstructions">
			<img src="remoteillustration.png" alt="Remote Instructions" />
		</div>
	);
}

class Slide extends Component {
	constructor(props) {
		super(props);
		
		this.onClick = this.onClick.bind(this);
		this.allowDrop = this.allowDrop.bind(this);
		this.drop = this.drop.bind(this);
	}

	allowDrop(e) {
		this.props.allowDrop(e);
	}

	drop(e) {
		this.props.drop(e, this);
	}

	onClick() {
		this.props.select(this.props.id);
	}
	
	render() {
		var scale = (window.innerHeight*.8 - window.innerWidth*.08 - 4)/3240;
		var style = {
			transform: 'scale(' + scale + ', ' + scale + ')'
		};
		return(
			<div className="slide" onClick={this.onClick} onDragOver={this.allowDrop} onDrop={this.drop} id={this.props.id} style={style}>
				{this.props.children}
			</div>
		);
	}
}

function PanelEditor(props) {
	return(
		<div className="panelEditor">
			<span>Content panels</span>
			<Panel shape="fullscreen" id="fullscreen" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="threescreenv" id="threescreenv" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="sixscreenv" id="sixscreenv" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="onescreen" id="onescreen" draggable={true} bgcolor="#FFFFFF" /><br />
			<Panel shape="halfscreen" id="halfscreen" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="fourscreen" id="fourscreen" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="sixscreenh" id="sixscreenh" draggable={true} bgcolor="#FFFFFF" />
			<Panel shape="threescreenh" id="threescreenh" draggable={true} bgcolor="#FFFFFF" />
			<span><br /><br /><br />Overlay panel</span>
			<div id="overlaySelector">
				<div id="overlay1" onClick={props.addOverlay.bind(null, 1)}></div>
				<div id="overlay2" onClick={props.addOverlay.bind(null, 2)}></div>
				<div id="overlay3" onClick={props.addOverlay.bind(null, 3)}></div>
				<div id="overlay4" onClick={props.addOverlay.bind(null, 4)}></div>
				<div id="overlay5" onClick={props.addOverlay.bind(null, 5)}></div>
				<div id="overlay6" onClick={props.addOverlay.bind(null, 6)}></div>
				<div id="overlay7" onClick={props.addOverlay.bind(null, 7)}></div>
				<div id="overlay8" onClick={props.addOverlay.bind(null, 8)}></div>
				<div id="overlay9" onClick={props.addOverlay.bind(null, 9)}></div>
			</div>
		</div>
	);
}

function AddSlide(props) {
	return(
		<div className="addSlide" onClick={props.onClick} draggable={false}>
			<img src="addSlide.jpg" alt="Add Slide" draggable={false} onDragStart={function(e) {e.preventDefault()}} />
		</div>
	);
}

class Remove extends Component {
	constructor(props) {
		super(props);
		this.onClick = this.onClick.bind(this);
	}

	onClick() {
		this.props.onClick(this.props.object);
	}

	render() {
		return(
			<div className="remove" onClick={this.onClick} style={{backgroundColor: "#FFFFFF"}}>X</div>
		);
	}
}

function SlideTray(props) {
	return(
		<div className="slideTray">
			{props.children}
		</div>
	);
}

class MenuButton extends Component {
	constructor(props) {
		super(props);
		this.handleClick = this.handleClick.bind(this);
	}

	handleClick() {
		this.props.onClick(this.props.param.toString());
	}

	render() {
		return(
			<div className={"menuButton " + ((this.props.active)? "buttonActive" : "")} onClick={this.handleClick}>
				<label className="switch">
					<input type="checkbox" checked={this.props.active} onClick={this.handleClick} />
					<div className="slider"></div>
				</label><br />
				<span>{this.props.label}</span>
			</div>
		);
	}
}

function SaveButton(props) {
	return (
		<div className={"menuButton saveButton"} onClick={props.onClick}>
			<span className="switch">
				&#128190;
			</span>
			<span>Save</span>
		</div>
	);
}

function OpenButton(props) {
	return (
		<div className={"menuButton saveButton"}>
			<label>
			<input accept=".js" type="file" style={{display: 'none'}} onChange={props.onClick} />
			<span className="switch">
				&#128194;
			</span>
			<span>Open</span>
			</label>
		</div>
	);
}

function Menu(props) {
	return(
		<div className="menu">
			<MenuButton label="speech synthesis" param="speechSynthesis" onClick={props.onChange} active={props.speechSynthesis} />
			<MenuButton label="progress bar" param="progressBar" onClick={props.onChange} active={props.progressBar} />
			<MenuButton label="remote instructions" param="remoteInstructions" onClick={props.onChange} active={props.remoteInstructions} />
			<MenuButton label="translation options" param="translations" onClick={props.onChange} active={props.translations} />
			<MenuButton label="slide transitions" param="transitions" onClick={props.onChange} active={props.transitions} />
			{props.translations? <LanguageSelector edit={props.edit} remove={props.remove} input={props.input} languages={props.languages} currentLanguage={props.currentLanguage} /> : ""}
			{props.saveButton? <SaveButton onClick={props.save} /> : <OpenButton onClick={props.open} />}
		</div>
	);
}

class Arrow extends Component {
	constructor(props) {
		super(props);
		
		this.goLeft = this.goLeft.bind(this);
		this.goRight = this.goRight.bind(this);
	}

	goLeft() {
		this.props.onClick(-1);
	}

	goRight() {
		this.props.onClick(1);
	}
	
	render() {
		return(
			<div className={"arrow" + ((this.props.direction === "left")? "l" : "r")} onClick={(this.props.direction === "left")? this.goLeft : this.goRight}>
				{(this.props.direction === "left")? "<" : ">"}
			</div>
		);
	}
}

function PreviewPane(props) {
	return(
		<div className="previewPane">
			{(props.currentSlide > 0)? <Arrow direction="left" onClick={props.onClick} /> : ""}
			{props.children}
			{(props.currentSlide < props.totalSlides - 1)? <Arrow direction="right" onClick={props.onClick} /> : ""}
		</div>
	);
}

class Project extends Component {
	constructor(props) {
		super(props);
		this.open = this.open.bind(this);
		this.save = this.save.bind(this);
		this.handleContent = this.handleContent.bind(this);
		this.handleSettingsChange = this.handleSettingsChange.bind(this);
		this.moveBySlide = this.moveBySlide.bind(this);
		this.addSlide = this.addSlide.bind(this);
		this.selectSlide = this.selectSlide.bind(this);
		this.removeSlide = this.removeSlide.bind(this);
		this.moveSlide = this.moveSlide.bind(this);
		this.slideDrop = this.slideDrop.bind(this);
		this.slideDrag = this.slideDrag.bind(this);
		this.slideAllowDrop = this.slideAllowDrop.bind(this);
		this.panelDrop = this.panelDrop.bind(this);
		this.panelMoveDrop = this.panelMoveDrop.bind(this);
		this.editPanel = this.editPanel.bind(this);
		this.saveContent = this.saveContent.bind(this);
		this.cancelContent = this.cancelContent.bind(this);
		this.addPanel = this.addPanel.bind(this);
		this.addOverlayPanel = this.addOverlayPanel.bind(this);
		this.removePanel = this.removePanel.bind(this);
		this.changeBackground = this.changeBackground.bind(this);
		this.addLanguage = this.addLanguage.bind(this);
		this.removeLanguage = this.removeLanguage.bind(this);
		this.editLanguages = this.editLanguages.bind(this);
		this.cancelLanguages = this.cancelLanguages.bind(this);
		this.changeLanguage = this.changeLanguage.bind(this);
		this.editPanelSetting = this.editPanelSetting.bind(this);

		this.state = {
			speechSynthesis: false, 
			progressBar: false,
			remoteInstructions: false,
			transitions: false,
			translations: false,
			languages: [new Language("American English")],
			currentLanguage: "American English",
			slides: [],
			slideMaxKey: 0,
			currentSlide: 0,
			editing: false,
			currentPanel: null,
			contentToEdit: "",
			editingLanguages: false
		}
	}

	handleContent(string, slide, panel) {
		this.setState({currentSlide: slide, currentPanel: panel});

		var content = /<img src='([^']*)' \/>/.exec(string);
		if (content) {
			this.editPanelSetting("image", true);
			if (this.state.translations) {
				this.changeLanguage(0);
				this.saveContent(content[1], "nopreviewavailable");
			} else {
				this.saveContent(content[1], "nopreviewavailable");
			}
		} else {
			if (this.state.translations) {
				content = string.slice(1, -3).split("\", \"");
				for (var i = 0; i < this.state.languages.length; i++) {
					this.changeLanguage(i);
					this.saveContent(stateFromHTML(content[i]));
				}
			} else {
				this.saveContent(stateFromHTML(string));
			}
		}
	}

	open(e) {
		var regex = /const [^=]*= \[(.*?)\]/;
		var file = e.target.files[0];
		reader.addEventListener("load", function() {
			var stateChanges = {};
			var data = reader.result;
			data = data.split(";");
			for (var i = 0; i < dataPoints.length; i++) {
				if (data.shift().includes("true")) {
					stateChanges[dataPoints[i]] = true;
				}
			}
			data.shift();
			var languageNames = regex.exec(data.shift());
			languageNames = languageNames[1].replace(/"/g, "").split(", ");
			var languageTags = regex.exec(data.shift());
			languageTags = languageTags[1].replace(/"/g, "").split(", ");
			stateChanges.languages = [];
			for (var i = 0; i < languageNames.length; i++) {
				stateChanges.languages.push(new Language(languageNames[i], languageTags[i]));
			}
			stateChanges.currentLanguage = stateChanges.languages[0].displayName;
			this.setState(stateChanges);

			var slideRegex;
			if (stateChanges.translations) {
				slideRegex = /new (Content|Popover)Box\(([^)]*img[^)]*|[^)]*\)[^)]*)\)/g;
			} else {
				slideRegex = /new (Content|Popover)Box\(([^)]*)\), /g;
			}

			regex = /new Contents\(([^)]*)\), /;

			var j;
			var panel;
			var content;
			var slides = data.shift().split(/],\r\n\r\n/);
			for (var i = 0; i < slides.length - 1; i++) {
				j = 0;
				this.addSlide();
				this.setState({currentSlide: i});
				while (panel = slideRegex.exec(slides[i])) {
					if (panel[1] == "Content") {
						if (stateChanges.translations) {
							panel = panel[2];
							content = regex.exec(panel);
							if (content) {
								panel = panel.slice(0, content.index) + panel.slice(content.index + content[0].length);
								panel = panel.slice(1, -1).split("\", \"");
								panel.splice(2, 0, content[1]);
							} else {
								panel = panel.slice(1, -1).split("\", \"");
							}
						} else {
							panel = panel[2].slice(1, -1).split("\", \"");
						}
						this.addPanel(i, panel[0], panel[1], (panel[3] == "padded"), panel[4], panel[5]);

						this.handleContent(panel[2], i, j);
					} else {
						if (stateChanges.translations) {
							panel = panel[2];
							content = regex.exec(panel);
							if (content) {
								panel = panel.slice(0, content.index) + panel.slice(content.index + content[0].length);
								panel = panel.slice(1, -1).split("\", \"");
								panel.splice(2, 0, content[1]);
							} else {
								panel = panel.slice(1, -1).split("\", \"");
							}
						} else {
							panel = panel[2].slice(1, -1).split("\", \"");
						}
						this.addOverlayPanel(reverseOverlayLocation(panel[0], panel[1]), panel[2], (panel[4] == "padded"), panel[5], panel[6]);
						this.handleContent(panel[3], i, j);
					}
					j++;
				}
			}

			this.setState({currentSlide: 0, currentPanel: null});
		}.bind(this), false);
		reader.readAsText(file);
	}

	save() {
		var data = [];

		for (var i = 0; i < dataPoints.length; i++) {
			data.push("var " + dataPoints[i].toLowerCase() + " = " + this.state[dataPoints[i]] + ";\n");
		}

		data.push("var currLanguage = \"" + this.state.currentLanguage + "\";\n");


		var names = [];
		var tags = [];
		for (var i = 0; i < this.state.languages.length; i++) {
			names.push("\"" + this.state.languages[i].displayName + "\"");
			tags.push("\"" + this.state.languages[i].tag + "\"");
		}

		data.push("const languageNames = [" + names.join(", ") + "];\n");
		data.push("const languages = [" + tags.join(", ") + "];\n");


		var slides = "const slides = [\n\n";
		var panel;
		for (var i = 0; i < this.state.slides.length; i++) {
			slides += "[\n";
			for (var j = 0; j < this.state.slides[i].panels.length; j++) {
				panel = this.state.slides[i].panels[j];
				slides += "new ";
				if (panel.overlay) {
					slides += "PopoverBox(";
					slides += overlayLocation(panel.location);
				} else {
					slides += "ContentBox(";
					slides += "\"" + panel.shape + "\", ";
				}
				slides += "\"" + panel.background + "\", ";
				if (panel.image) {
					slides += "\"<img src='data/" + panel.content[this.state.languages[0].displayName] + "' />\", ";
				} else if (panel.content) {
					if (this.state.translations) {
						slides += "new Contents(";
						for (var k = 0; k < this.state.languages.length; k++) {
							slides += "\"" + stateToHTML(panel.content[this.state.languages[k].displayName]) + "\", ";
						}
						slides += "), ";
					} else {
						slides += "\"" + stateToHTML(panel.content[this.state.currentLanguage]) + "\", ";
					}
				} else {
					slides += "\"\", ";
				}
				slides += (panel.padding? "\"padded\", " : "\"unpadded\", ");
				slides += "\"" + panel.align + "\", ";
				slides += "\"" + panel.valign + "\"";
				slides += "), \n";
			}
			slides += "],\n\n";
		}
		slides += "];\n";

		data.push(slides);
		

		var file = new File(data, "data.js", {type: 'plain/text'});
		var url = URL.createObjectURL(file);
		var link = document.createElement("a");
		link.download = "data.js";
		link.href = url;
		document.body.appendChild(link);
		link.click();
	}

	handleSettingsChange(setting) {
		this.setState(function(prevState, props) {
			return {
				[setting]: !prevState[setting]
			};
		});
	}

	changeLanguage(languageIndex) {
		this.setState(function(prevState, props) {
			return {
				currentLanguage: prevState.languages[languageIndex].displayName
			};
		});
	}

	editLanguages() {
		this.setState({editingLanguages: true});
	}

	cancelLanguages() {
		this.setState({editingLanguages: false});
	}

	addLanguage(displayName, tag) {
		this.setState(function(prevState, props) {
			if (prevState.languages.findIndex(function(language) {
				return (language.displayName == displayName);
			}) == -1) {
				prevState.languages.push(new Language(displayName, tag));
				
				for (var i = 0; i < prevState.slides.length; i++) {
					for (var j = 0; j < prevState.slides[i].panels.length; j++) {
						prevState.slides[i].panels[j].content[displayName] = EditorState.createEmpty().getCurrentContent();
					}
				}
				
				return {
					languages: prevState.languages, slides: prevState.slides, currentLanguage: displayName, editingLanguages: false
				};
			} else {
				alert("This language has already been added.");
			}
		});
	}

	removeLanguage(languageIndex) {
		this.setState(function(prevState, props) {
			var langName = prevState.languages[languageIndex].displayName;
			if (prevState.currentLanguage == langName) {
				if (languageIndex > 0) {
					prevState.currentLanguage = prevState.languages[languageIndex - 1].displayName;
				} else {
					prevState.currentLanguage = prevState.languages[languageIndex + 1].displayName;
				}
			}
			prevState.languages.splice(languageIndex, 1);

			for (var i = 0; i < prevState.slides.length; i++) {
				for (var j = 0; j < prevState.slides[i].panels.length; j++) {
					delete prevState.slides[i].panels[j].content[langName];
				}
			}			
			
			return {
				languages: prevState.languages, slides: prevState.slides, currentLanguage: prevState.currentLanguage
			};
		});
	}

	editPanel(panel) {
		this.setState(function(prevState, props) {
			var panelIndex = prevState.slides[prevState.currentSlide].panels.findIndex(function(p) {return (p.key == panel.props.id)});
			return {
				editing: true, currentPanel: panelIndex, contentToEdit: prevState.slides[prevState.currentSlide].panels[panelIndex].content[prevState.currentLanguage]
			};
		});
	}

	saveContent(text, imagePreview) {
		this.setState(function(prevState, props) {
			prevState.slides[prevState.currentSlide].panels[prevState.currentPanel].content[(imagePreview? prevState.languages[0].displayName : prevState.currentLanguage)] = text;
			if (imagePreview) {
				prevState.slides[prevState.currentSlide].panels[prevState.currentPanel].imagePreview = imagePreview;
			}
			return {
				editing: false, contentToEdit: "", slides: prevState.slides
			};
		});
	}

	editPanelSetting(setting, option) {
		this.setState(function(prevState, props) {
			prevState.slides[prevState.currentSlide].panels[prevState.currentPanel][setting] = option;
			return {
				slides: prevState.slides
			};
		});
	}

	cancelContent() {
		this.setState(function(prevState, props) {
			return {
				editing: false, contentToEdit: ""
			};
		});
	}

	addPanel(slide, shape, background, padding, align, valign) {
		this.setState(function(prevState, props) {
			var slideIndex;
			if (slide.id) {
				slideIndex = prevState.slides.findIndex(function(s) {return (s.id == slide.props.id)});
			} else {
				slideIndex = slide;
			}
			prevState.slides[slideIndex].panelMaxKey++;
			var content = {};
			for (var i = 0; i < prevState.languages.length; i++) {
				content[prevState.languages[i].displayName] = ContentState.createFromText("");
			}
			prevState.slides[slideIndex].panels.push({shape: shape, key: prevState.slides[slideIndex].panelMaxKey, background: background || "dark", padding: padding, image: false, valign: valign || "middle", align: align || "center", content: content, overlay: false});
			return {
				slides: prevState.slides
			};
		});
	}

	addOverlayPanel(location, background, padding, align, valign) {
		this.setState(function(prevState, props) {
			prevState.slides[prevState.currentSlide].panelMaxKey++;
			var content = {};
			for (var i = 0; i < prevState.languages.length; i++) {
				content[prevState.languages[i].displayName] = ContentState.createFromText("");
			}
			prevState.slides[prevState.currentSlide].panels.push({shape: 'onescreen', key: prevState.slides[prevState.currentSlide].panelMaxKey, background: background || "dark", padding: padding, image: false, valign: valign || "middle", align: align || "center", content: content, overlay: true, location: location});
			return {
				slides: prevState.slides
			};
		});
	}

	removePanel(panel) {
		this.setState(function(prevState, props) {
			var panelIndex = prevState.slides[prevState.currentSlide].panels.findIndex(function(p) {return(p.key == panel)});
			prevState.slides[prevState.currentSlide].panels.splice(panelIndex, 1);
			return {
				slides: prevState.slides
			}
		});
	}

	movePanel(panelID, position) {
		this.setState(function(prevState, props) {
			var index = prevState.slides[prevState.currentSlide].panels.findIndex(function(p){return(p.key == panelID)});
			var panel = prevState.slides[prevState.currentSlide].panels[index];
			var positionIndex = prevState.slides[prevState.currentSlide].panels.findIndex(function(p){return(p.key == position)});
			if (positionIndex >= index) {
				prevState.slides[prevState.currentSlide].panels.splice(positionIndex + 1, 0, panel);
				prevState.slides[prevState.currentSlide].panels.splice(index, 1);
			} else {
				prevState.slides[prevState.currentSlide].panels.splice(index, 1);
				prevState.slides[prevState.currentSlide].panels.splice(positionIndex, 0, panel);
			}
			return {
				slides: prevState.slides
			};
		});
	}			

	changeBackground(background, panel) {
		this.setState(function(prevState, props) {
			var panelIndex = prevState.slides[prevState.currentSlide].panels.findIndex(function(p) {return(p.key == panel)});
			prevState.slides[prevState.currentSlide].panels[panelIndex].background = background;
			return {
				slides: prevState.slides
			};
		});
	}

	addSlide() {
		this.setState(function(prevState, props) {
			prevState.slideMaxKey++;
			prevState.slides.push({id: prevState.slideMaxKey, panels: [], panelMaxKey: 0});
			return {
				slides: prevState.slides, currentSlide: (prevState.slides.length - 1)
			};
		});
	}

	removeSlide(slide) {
		this.setState(function(prevState, props) {
			var index = prevState.slides.findIndex(function(s){return(s.id == slide)});
			if ((prevState.currentSlide >= index) && (prevState.currentSlide > 0)) {
				prevState.currentSlide--;
			}
			prevState.slides.splice(index, 1);
			return {
				slides: prevState.slides, currentSlide: prevState.currentSlide
			};
		});
	}

	moveSlide(slideID, position) {
		this.setState(function(prevState, props) {
			var index = prevState.slides.findIndex(function(s){return(s.id == slideID)});
			var slide = prevState.slides[index];
			var positionIndex = prevState.slides.findIndex(function(s){return(s.id == position)});
			if (positionIndex >= index) {
				prevState.slides.splice(positionIndex + 1, 0, slide);
				prevState.slides.splice(index, 1);
			} else {
				prevState.slides.splice(index, 1);
				prevState.slides.splice(positionIndex, 0, slide);
			}
			if (prevState.currentSlide > index && prevState.currentSlide <= positionIndex) {
				this.moveBySlide(-1);
			} else if (prevState.currentSlide < index && prevState.currentSlide >= positionIndex) {
				this.moveBySlide(1);
			} else if (prevState.currentSlide === index) {
				this.selectSlide(prevState.slides[positionIndex].id);
			}
			return {
				slides: prevState.slides
			};
		});
	}
	
	selectSlide(slide) {
		this.setState(function(prevState, props) {
			return {currentSlide: prevState.slides.findIndex(function(s){return(s.id === slide)})}
		});
	}

	moveBySlide(amount) {
		this.setState(function(prevState, props) {
			return {
				currentSlide: prevState.currentSlide + amount
			};
		});
	}

	slideDrag(e) {
		e.dataTransfer.setData("text/plain", e.target.id);
		panel = false;
	}

	slideAllowDrop(e) {
		if (!panel) {
			e.preventDefault();
			return false;
		}
	}

	slideDrop(e) {
		if (!panel) {
			e.preventDefault();
			this.moveSlide(e.dataTransfer.getData("text/plain"), e.target.id);
			return false;
		}
	}

	panelAllowDrop(e) {
		if (panel && !move) {
			e.preventDefault();
			return false;
		} 
	}

	panelDrop(e, slide) {
		if (panel && !move) {
			e.preventDefault();
			this.addPanel(slide, e.dataTransfer.getData("text/plain"));
			return false;
		}
	}

	panelMoveAllowDrop(e) {
		if (panel && move) {
			e.preventDefault();
			return false;
		}
	}
	
	panelMoveDrop(e) {
		if (panel && move) {
			e.preventDefault();
			this.movePanel(e.dataTransfer.getData("text/plain"), e.target.id);
			return false;
		}
	}

	render() {
		return(
			<div className="container">
			{(this.state.editing || this.state.editingLanguages)? <ScreenDimmer /> : ""}
			{this.state.editing? <TextEditor defaultText={this.state.contentToEdit} save={this.saveContent} cancel={this.cancelContent} edit={this.editPanelSetting} panel={this.state.slides[this.state.currentSlide].panels[this.state.currentPanel]} language={this.state.currentLanguage} /> : ""}
			{this.state.editingLanguages? <LanguageEditor add={this.addLanguage} cancel={this.cancelLanguages} /> : ""}
			<PreviewPane currentSlide={this.state.currentSlide} totalSlides={this.state.slides.length} onClick={this.moveBySlide}>
				<Menu speechSynthesis={this.state.speechSynthesis} progressBar={this.state.progressBar} remoteInstructions={this.state.remoteInstructions} transitions={this.state.transitions} translations={this.state.translations} onChange={this.handleSettingsChange} input={this.changeLanguage} edit={this.editLanguages} remove={this.removeLanguage} languages={this.state.languages} currentLanguage={this.state.currentLanguage} save={this.save} open={this.open} saveButton={this.state.slides.length} />
				{(this.state.slides.length > 0)?
					<Slide id={this.state.slides[this.state.currentSlide].id}  move={function(){}} select={function(){}} drop={this.panelDrop} allowDrop={this.panelAllowDrop}>
					{this.state.progressBar? <ProgressBar percent={(this.state.currentSlide + 1)/this.state.slides.length*100} /> : ""}
					{this.state.remoteInstructions? <RemoteInstructions /> : ""}
					{this.state.slides[this.state.currentSlide].panels.map(
						function (panel, i) {
							return (<Panel id={panel.key} key={panel.key + panel.shape + panel.content + panel.background} content={panel.content[this.state.currentLanguage]} overlay={panel.overlay} location={panel.location} padding={panel.padding} image={panel.image}  imagePreview={panel.imagePreview} valign={panel.valign} align={panel.align} shape={panel.shape} move={true} draggable={true} background={panel.background} drop={this.panelMoveDrop} allowDrop={this.panelMoveAllowDrop} edit={this.editPanel}><BackgroundColorMenu change={this.changeBackground} panel={panel.key} overlay={panel.overlay} /><Remove onClick={this.removePanel} object={panel.key} /></Panel>);
						}, this
					)}
				</Slide> : ""}
			</PreviewPane>
			<SlideTray>
				{this.state.slides.map(
					function (slide, i) { 
						return <div className="slidePreview" key={slide.id} id={slide.id} draggable="true" onDragStart={this.slideDrag} onDragOver={this.slideAllowDrop} onDrop={this.slideDrop}>
						<Slide id={slide.id} move={this.moveSlide} select={this.selectSlide} drop={function(){}} allowDrop={function(){}}>
							{slide.panels.map(
								function (panel, i) {
									return <Panel id={panel.key} key={panel.key + panel.shape + panel.content[this.state.currentLanguage] + panel.background} content={panel.content[this.state.currentLanguage]} shape={panel.shape} background={panel.background} overlay={panel.overlay} location={panel.location} padding={panel.padding} image={panel.image} valign={panel.valign} align={panel.align}></Panel>;
								}, this
							)}
						</Slide>
						<Remove onClick={this.removeSlide} object={slide.id} />
					</div>;
					}, this
				)}
				<AddSlide onClick={this.addSlide} />
			</SlideTray>
			<PanelEditor addOverlay={this.addOverlayPanel} />
			</div>
		);
	}
}


class App extends Component {
  render() {
	return (
		<Project />
	);
  }
}

export default App;
