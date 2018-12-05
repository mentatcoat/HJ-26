///// ///// ///// /////РИСОВАНИЕ в CANVAS
fixColor("green"); // выставляем первый цвет по умолчанию Зеленый

let inside = false; //переменная говорит что курсор внутри Канвы
let pointX = null; //стартовые точки рисования
let pointY = null;

//навесили слушатели всем input radio выбор цвета
Array.from(document.querySelectorAll(".menu__color")).forEach(menuColor => {
  menuColor.addEventListener("click", event => {
    fixColor(event.currentTarget.value); //устанавливаем цвет рисования
  });
}); // END слушатели для menuColors

//функция навешивающая слушатели элементу Canvas
function initCanvasListeners() {
  canvas.addEventListener("mousedown", () => {
    inside = true;
  });
  canvas.addEventListener("mousemove", drawMouse);
  canvas.addEventListener("mouseleave", () => inside = false);
} //END initCanvasListeners


//функция подгоняет размеры элемента CANVAS под элемент image
function resizeCanvas() {
  let imageBounds = image.getBoundingClientRect();
  canvas.style.left = `${imageBounds.left}px`;
  canvas.style.top = `${imageBounds.top}px`;
  canvas.height = imageBounds.height;
  canvas.width = imageBounds.width;
} //END f resizeClearCanvas
/// ///

//функция рисования по Канве
function drawMouse(e) {
  //если указатель внутри канвас и нажата левая кнопка:
  if (inside && pointX && isButtonPressed(1, e.buttons)) {
    ctx.beginPath();
    ctx.moveTo(pointX, pointY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.lineWidth = 4;
    ctx.strokeStyle = drawingColor;
    ctx.stroke();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    pointX = e.offsetX;
    pointY = e.offsetY;
    //здесь дебаунс функции saveSroke()
    saveStrokeDebounced();
  } else {
    pointX = e.offsetX;
    pointY = e.offsetY;
  }
} //END drawMouse

///функция которая выставляет оттенок по переданному значению-строке
function fixColor(color) {
  switch (color) {
    case "red":
      drawingColor = "#ea5d56";
      break;
    case "yellow":
      drawingColor = "#f3d135";
      break;
    case "green":
      drawingColor = "#6cbe47";
      break;
    case "blue":
      drawingColor = "#53a7f5";
      break;
    case "purple":
      drawingColor = "#b36ade";
      break;
  }
} //END f fixColor

//функция проверяющая что нажата левая кнопка мыши
function isButtonPressed(buttonCode, pressed) {
  return (pressed & buttonCode) === buttonCode;
}

function saveStroke() {
  //функция сохранения фрагмента рисунка пользователя
  let base64 = canvas.toDataURL();
  let newImg = image.cloneNode();
  newImg.src = base64;
  newImg.style.pointerEvents = "none";
  wrapApp.insertBefore(newImg, errorDiv); //добавили слой своего рисунка в разметку, после всех <img>
  //отправили фрагмент своего рисунка на сервер
  canvas.toBlob(blobFile => {
    WSConnection.send(blobFile);
  });
  //чистим канвас
  ctx.clearRect(0, 0, canvas.width, canvas.height);
} // END f saveSroke

function debounce(callback, delay) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      callback();
    }, delay);
  };
} //END f debounce

//создаем дебаунс-версию фукнции saveSroke
let saveStrokeDebounced = debounce(saveStroke, 3000);

//функция для вставки маски по URL
function insertMask(maskURL) {
  if (!maskURL) return;
  let mask = image.cloneNode(); //создаем маску на основе image
  mask.style.pointerEvents = "none"; //отключаем чувствительность к мыши
  mask.src = maskURL;
  wrapApp.insertBefore(mask, errorDiv); //добавили маску в разметку
} //END insertMask
/// ///

///// ///// ///// /////конец РИСОВАНИЕ
