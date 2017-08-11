var synthesisSupported = false;
var synthesis;
var voice = null;

var languageMenu = 0;
var menuOption = 0;

var languageMenu = 0;

var htmlSlides = [];
var verbalSlides = [];

var currentSlide = 0;

function getVoices() {
	var voices = speechSynthesis.getVoices();
	var defaultVoice;
	for (var i = 0; i < voices.length; i++) {
		if (voices[i].lang == currLanguage) {
			voice = voices[i];
		} else if (voices[i].default) {
			defaultVoice = voices[i];
		}
	}
	if (voice == null) {
		voice = defaultVoice;
	}

	for (i = 0; i < verbalSlides.length; i++) {
		for (var j = 0; j < verbalSlides[i].length; j++) {
			verbalSlides[i][j].voice = voice;
			verbalSlides[i][j].lang = voice.lang;
		}
	}

	moveSlides(0);
}

function processText(text) {
	var processed = text.replace(/(<br \/>|&mdash\;)/g, ". \r");
	processed = processed.replace(/&ndash\;/g, "-");
	processed = processed.replace(/lead white/g, "led white");
	processed = processed.replace(/(<[^>]*>|&[^\;]*\;)/g, " ");
	if ((/\d in\./).test(processed)) {
		processed = processed.replace(/in\./, "inches");
	}
	processed += "\r  ";
	return processed.split(/\;|\. |:/);
}

function setSpeech() {
	if (speechsynthesis) {
		synthesis.cancel();
		speechsynthesis = false;
	} else {
		speechsynthesis = true;
		moveSlides(0);
	}
}

function setLanguage(language) {
	currLanguage = language;
	for (var i = 0; i < languages.length; i++) {
		$("." + languages[i] + "slides").css("display", "none");
	}
	$("." + language + "slides").css("display", "block");

	if (synthesisSupported) {
		getVoices();
	}
}

function showMenu() {
	if (languageMenu == 0) {
		$("#languagemenu").css("display", "block");
	} else {
		languageMenu--;
	}
}

function nextOption() {
	if (menuOption < (languages.length + speechsynthesis)) {
		$("#option" + menuOption).css("color", "#AAAAAA");
		menuOption++;
		$("#option" + menuOption).css("color", "#FFFFFF");
	}
}

function previousOption() {
	if (menuOption > 0) {
		$("#option" + menuOption).css("color", "#AAAAAA");
		menuOption--;
		$("#option" + menuOption).css("color", "#FFFFFF");
	}
}

function selectOption() {
	if (menuOption < languages.length) {
		setLanguage($("#option" + menuOption).attr("class"));
	} else if ((speechsynthesis) && (menuOption == languages.length)) {
		setSpeech();
	} 
	$("#languagemenu").css("display", "none");
	languageMenu = 10;
}

function setup() {
	sizeScreens();

	if (window.speechSynthesis != undefined && speechsynthesis == true) {
		synthesis = window.speechSynthesis;
		synthesisSupported = true;

		setTimeout(getVoices, 15);
	} else {
		speechsynthesis = false;
	}
	
	if (remoteinstructions) {
		$("#container").append("<img src=\"data/remoteillustration.png\" class=\"remoteinstructions\" />");
	}
	if (progressbar) {
		$("#container").append("<div id=\"progressbar\"></div>");
	}
	if (translations || speechsynthesis) {
		setInterval(showMenu, 10000);
		var menu = "<div id=\"languagemenu\"><span class=\"content middle\">";
		var i = 0;
		if (translations) {
			for (i = 0; i < languages.length; i++) {
				menu += "<h2 id=\"option" + i + "\" class=\"" + languages[i] + "\">" + languageNames[i] + "</h2><br />";
			}
			menu += "<br /><br /><br />";
		}
		if (speechsynthesis) {
			menu += "<h2 id=\"option" + i + "\">Toggle synthesized voice</h2><br /><br /><br /><br />";
			i++;
		}
		menu += "<span id=\"option" + i + "\">Use the arrow keys to navigate this menu, or select this option to close</span>";
		menu += "</span></div>";
		$("#container").append(menu);
	}

	if (translations) {
		for (var l = 0; l < languages.length; l++) {
			currLanguage = languages[l];
			var slide;
			for (var i = 0; i < slides.length; i++) {
				slide = $("<div class=\"slide " + currLanguage + "slides\"></div>");
				$("#slides").append(slide);
				verbalSlides[i] = [];
				htmlSlides[i] = [];
				for (var j = 0; j < slides[i].length; j++) {
					htmlSlides[i][j] = $(slides[i][j].toString());
					slide.append(htmlSlides[i][j]);
					if (synthesisSupported) {
						var sentences = processText(slides[i][j].contents.toString());
						for (var k = 0; k < sentences.length; k++) {
							verbalSlides[i].push(new SpeechSynthesisUtterance(sentences[k]));
						}
					}
				}
			}
		}
		currLanguage = languages[0];
	} else {
		var slide;
		for (var i = 0; i < slides.length; i++) {
			slide = $("<div class=\"slide\"></div>");
			$("#slides").append(slide);
			verbalSlides[i] = [];
			htmlSlides[i] = [];
			for (var j = 0; j < slides[i].length; j++) {
				htmlSlides[i][j] = $(slides[i][j].toString());
				slide.append(htmlSlides[i][j]);
				if (synthesisSupported) {
					var sentences = processText(slides[i][j].contents.toString());
					for (var k = 0; k < sentences.length; k++) {
						verbalSlides[i].push(new SpeechSynthesisUtterance(sentences[k]));
					}
				}
			}
		}
		languageMenu = -1;
	}

	if (transitions) {
		$("#progressbar").css({"transition": "width 3s", "will-change": "width"});
		$(".slide").css({"transition": "transform 3s", "will-change": "transform"});
	}

	$("#slides").css("width", 100*slides.length + "%");

	setTimeout(sizeResponsive, 50);
}

function sizeResponsive() {
	var contentWidths = [];
	var contentHeights = [];	
	$(".responsivecontent").each(function(i, obj) {
		var img = $(this).find("img")[0];
		var wRatio = 5760/img.naturalWidth;
		var hRatio = 3240/img.naturalHeight;

		if (wRatio < hRatio) {
			$(this).css({"width": 5760 + "px", "height": img.naturalHeight*wRatio + "px"});
			contentWidths[i] = 5760;
			contentHeights[i] = img.naturalHeight*wRatio;
		} else {
			$(this).css({"width": img.naturalWidth*hRatio + "px", "height": 3240 + "px"});
			contentWidths[i] = img.naturalWidth*hRatio;
			contentHeights[i] = 3240;
		}
	});

	$(".responsivesidebar").each(function(i, obj) {
		if (contentWidths[i] == 5760) {
			$(this).css({"width": 5760 + "px", "height": 3240 - contentHeights[i] + "px"});
		} else {
			$(this).css({"width": 5760 - contentWidths[i] + "px", "height": 3240 + "px"});
		}
	});
}

// modular arithmetic that handles negatives
function mod(x, y) {
	return (x%y + y)%y;
}

window.onresize = function(event){
	sizeScreens();
}

function sizeScreens() {
	var scaleW = $(window).width()/$("#container").width();
	var scaleH = $(window).height()/$("#container").height();
	if (scaleW < scaleH) {
		$("#container").css("transform", "scale(" + scaleW + ", " + scaleW + ")");
		$("#container").css({"top": ($(window).height() - $("#container").height()*scaleW)/2 + "px", "left": "0px"});
	} else {
		$("#container").css("transform", "scale(" + scaleH + ", " + scaleH + ")");
		$("#container").css({"top": "0px", "left": ($(window).width() - $("#container").width()*scaleH)/2 + "px"});
	} 
}

function moveSlides(count) {
	currentSlide += count;
	currentSlide = mod(currentSlide, slides.length);

	$(".slide").css("transform", "translateX(-" + currentSlide*100 + "%)");
	$("#progressbar").css("width", currentSlide/(slides.length - 1)*100 + "%");

	if (speechsynthesis && synthesisSupported) {
		synthesis.cancel();
		for (var i = 0; i < verbalSlides[currentSlide].length; i++) {
			synthesis.speak(verbalSlides[currentSlide][i]);
		}
	}
}

document.addEventListener("keydown", function(event) {
	switch (event.keyCode) {
		case 37: // left and up
		case 38:
			if (languageMenu == 0) {
				previousOption();
			} else {
				moveSlides(-1);
				languageMenu = 10;
			}
			break;
		case 39: // right and down
		case 40:
			if (languageMenu == 0) {
				nextOption();
			} else {
				moveSlides(1);
				languageMenu = 10;
			}
			break;
		case 13: // enter
			if (languageMenu == 0) {
				selectOption();
			} else {
				languageMenu = 0;
				showMenu();
			}
			break;
	}
});

