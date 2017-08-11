function ContentBox(shape, background, contents, padding, alignment, vertical) {
	if (padding == undefined) {
		padding = "padded";
	}
	if (alignment == undefined) {
		alignment = "center";
	}	
	if (vertical == undefined) {
		vertical = "middle";
	}

	this.shape = shape;
	this.background = background;
	this.contents = contents;
	this.padding = padding;
	this.alignment = alignment;
	this.vertical = vertical;
}

ContentBox.prototype.toString = function contentToString() {
	var ret = "<div class=\"contentbox " + this.background + "background " + this.shape + "\"><span class=\"content " + this.padding + " " + this.alignment + " " + this.vertical + "\">" + this.contents + "</span></div>";
	
	return ret;
}

function PopoverBox(row, column, background, contents, padding, alignment, vertical) {
	if (padding == undefined) {
		padding = "padded";
	}
	if (alignment == undefined) {
		alignment = "center";
	}	
	if (vertical == undefined) {
		vertical = "middle";
	}

	this.row = row;
	this.column = column;
	this.background = background;
	this.contents = contents;
	this.padding = padding;
	this.alignment = alignment;
	this.vertical = vertical;
}

PopoverBox.prototype.toString = function popoverToString() {
	var ret = "<div class=\"contentbox " + this.background + "background popover " + this.row + "row " + this.column + "column\"><span class=\"content " + this.padding + " " + this.alignment + " " + this.vertical + "\">" + this.contents + "</span></div>";
	
	return ret;
}

// Placeholder function, in case using a translation service
// makes sense
function translate(text, language) {
	return text;
}

function Contents(defaultText) {
	this.contents = [defaultText];
	for (var i = 1; i < languages.length; i++) {
		if (arguments[i] == undefined) {
			arguments[i] = translate(defaultText, languages[i]);
		}
		this.contents.push(arguments[i]);
	}
}

Contents.prototype.toString = function contentsToString() {
	var ret;
	if (translations) {
		ret = this.contents[languages.indexOf(currLanguage)];
	} else {
		ret = this.contents[0];
	}
	return ret;
}