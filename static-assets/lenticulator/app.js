window.addEventListener("DOMContentLoaded", (event) => {
	const leftFileInput = document.getElementById("leftImageInput"),
		leftImagePreview = document.getElementById("leftImagePreview"),
		rightFileInput = document.getElementById("rightImageInput"),
		rightImagePreview = document.getElementById("rightImagePreview");
	leftImagePreview.addEventListener("load", updateOutput);
	rightImagePreview.addEventListener("load", updateOutput);
	leftFileInput.addEventListener("change", (event) => {
		loadImage(leftFileInput,leftImagePreview);
	});
	rightFileInput.addEventListener("change", (event) => {
		loadImage(rightFileInput,rightImagePreview);
	});
	const btnPrint = document.getElementById("btnPrint");
	btnPrint.addEventListener("click", (event) => {
		window.print();
	});
	const inputNumberOfOutputSlices = document.getElementById("inputNumberOfOutputSlices");
	inputNumberOfOutputSlices.addEventListener("change", updateOutput);
	updateOutput();
});

function loadImage(fileInput,imagePreview) {
	const file = fileInput.files[0];
	const imageType = /image.*/;
	if (file.type.match(imageType)) {
		const reader = new FileReader();
		reader.onload = (event) => {
			imagePreview.src = reader.result;
		}
		reader.readAsDataURL(file); 
	} else {
		alert("Unrecognised file type")
	}
}

function updateOutput() {
	// Number of pairs of vertical slices
	const numOutputSlices = parseInt(document.getElementById("inputNumberOfOutputSlices").value);
	// Get dom references
	const leftImagePreview = document.getElementById("leftImagePreview"),
		rightImagePreview = document.getElementById("rightImagePreview"),
		outputWrapper = document.getElementById("outputWrapper");
	// Clear the output
	while(outputWrapper.firstChild) {
		outputWrapper.removeChild(outputWrapper.firstChild);
	}
	// Set the height of the output wrapper
	const leftAspectRatio = leftImagePreview.naturalHeight / leftImagePreview.naturalWidth,
		rightAspectRatio = rightImagePreview.naturalHeight / rightImagePreview.naturalWidth;
	outputWrapper.style.height = `${Math.max(leftAspectRatio, rightAspectRatio) * outputWrapper.offsetWidth/2}px`;
	// Bail if either image is not loaded
	if(!leftImagePreview.complete || !rightImagePreview.complete) {
		return;
	}
	// Percent width of each slice of original image
	const sliceWidth = 100 / numOutputSlices;
	// Helper to render a single slice
	const addImageSlice = (imageSrc,xBase,xOffset) => {
		// Create the image element
		const img = document.createElement("img");
		img.src = imageSrc;
		// Clip the image to get the current slice
		img.style.clipPath = `polygon(${xBase}% 0%, ${xBase + sliceWidth}% 0%, ${xBase + sliceWidth}% 100%, ${xBase}% 100%)`;
		// Position the slice accounting for the clip rectangle
		img.style.position = "absolute"
		img.style.left = (xBase + xOffset - xBase/2) + "%";
		img.style.width = "50%";
		outputWrapper.appendChild(img);
	}
	// Render the image slices
	const imgLeftImageSrc = leftImagePreview.src,
		imgRightImageSrc = rightImagePreview.src;
	for(var x = 0; x < 100; x += sliceWidth) {
		addImageSlice(imgLeftImageSrc,x,0);
		addImageSlice(imgRightImageSrc,x,sliceWidth / 2);
	}
}
