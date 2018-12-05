`use strict`;


let wrapApp = document.querySelector(".wrap.app"); //главный контейнер
wrapApp.style.position = "relative";
let menu = document.querySelector(".menu");
let menuBounds = menu.getBoundingClientRect(); // определение текущих границ элемента Меню
let modeItems = Array.from(document.querySelectorAll(".mode")); //массив кнопок режимов
let image = document.querySelector(".current-image"); //элемент с размещенной картинкой
let firstImageSrc = image.src; //первичное состояние, для проверки на drag&drop
//чтобы картинка не таскалась по экрану если кликнуть и потянуть:
image.addEventListener("dragstart", event => event.preventDefault());
let placedImageId; //сохраняем сюда ID картинки с сервера
let errorDiv = document.querySelector(".error"); //элемент показывающий ошибку
let imageLoaderDiv = document.querySelector(".image-loader"); //прелоадер
let movedMenu; //переменная для перетаскивания меню по экрану
let deltaX, deltaY; //переменные для корректировки положения меню при перемещении
let newComment; //переменная хранящая форму добавления комментария
let commentsBox = document.querySelector(".comments-box"); //контейнер комментов
commentsBox.style.position = "relative";
let commentsOn = document.getElementById("comments-on"); //кнопки ПОКАЗАТЬ/СКРЫТЬ комментарии
let commentsOff = document.getElementById("comments-off");
let WSConnection; //переменная WebSocket соединения
let canvas;
let ctx;
let drawingColor; // цвет рисования
let fileInput;

///// ///// ///// /////
//при движении по Истории запускаем функцию init, которая загружает нужное состояние приложения
window.addEventListener("popstate", event => {
  init();
});
/// ///

//при изменении размеров окна мы подгоняем размеры Канвы под image, также проверяем не распалось ли меню:
window.addEventListener("resize", () => {
  fixMenuBounds();
  resizeCanvas();
  resizeCommentsBox(); //подгонка блока комментариев под картинку
});
/// ///

// вешаем кнопкам-модам листенеры
modeItems.forEach((modeItem, index) => {
  modeItem.addEventListener("click", clickOnMode);
}); //END
//убираем листенер с мод нью, т к у него особое поведение при клике
document.querySelector(".new").removeEventListener("click", clickOnMode);

//листенер клик на кнопках режимов
function clickOnMode(event) {
  modeItems.forEach((elem, index) => elem.dataset.state = "");
  event.currentTarget.dataset.state = "selected";
  menu.dataset.state = "selected";
  fixMenuBounds(); //корректировка развалившегося меню
} //END clickOnMode
/// ///

//включаем рисование режим
modeItems[2].addEventListener("click", clickDrawMode);
/// ///
function clickDrawMode() {
  initCanvasListeners();
  canvas.style.pointerEvents = "auto"; //включаем реагирование Канвас
  resizeCanvas(); // подгоняем размеры Канвас под картинку
}//END f clickDrawMode



// режим Поделиться, клик, создание ссылки URL с параметрами
modeItems[3].addEventListener("click", clickShareMode);
/// ///
function clickShareMode() {
  // создаем и присваиваем URL с параметрами
  document.querySelector(".menu__url").value = location.href.split("?")[0] + "?id=" + placedImageId;
}//END f clickShareMode


// слушаетель кнопки КОПИРОВАТЬ
document.querySelector(".menu_copy").addEventListener("click", event => {
  document.querySelector(".menu__url").select(); //выделяем содержимое input элемента
  // ниже копируем в буфер выделенное, и выводим в консоль статус операции
  document.execCommand("copy");
});
/// ///

//??? эта функция не подтянулась из js файла загруженного ниже. Но при этом переменная canvas из этого файла, загрузилась в следующем-нижнем js файле. Почему?
// fixColor('green');// выставляем первый цвет по умолчанию Зеленый

//нажатие на бургер
document.querySelector(".burger").addEventListener("click", clickBurger);
/// ///
function clickBurger() {
  menu.dataset.state = "default";
  modeItems.forEach((elem, index) => elem.dataset.state = "");
  canvas.style.pointerEvents = "none"; //отключаем реакции canvas-элемента
  if (newComment) {
    newComment.remove(); //удаляем форму нов коммента
    newComment = null;
  }
  fixMenuBounds(); //починка развалившегося меню
}// END f clickBurger



//drag & drop of MENU перетаскивание
document.querySelector(".drag").addEventListener("mousedown", mousedownToDrag);
/// ///
function mousedownToDrag() {
  movedMenu = menu; //помещаем меню в переменную для перетаскивания
  menuBounds = menu.getBoundingClientRect();
  //ниже смещение координат клика мыши от left и top меню
  deltaX = event.pageX - menuBounds.x;
  deltaY = event.pageY - menuBounds.y;
}// END f mousedownOnDrag

document.addEventListener("mousemove", mousemoveMenu);
/// ///
function mousemoveMenu() {
  if (movedMenu) {
    //если меню в режиме перетаскивания, то:
    event.preventDefault();
    let x = event.pageX - deltaX;
    let y = event.pageY - deltaY;

    const minX = 0;
    const minY = 0;
    const maxX = window.innerWidth - menuBounds.width;
    const maxY = window.innerHeight - menuBounds.height;

    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    //новые вычисленные координаты меню сохраняем в localStorage и в меню
    movedMenu.style.left = localStorage.menuLeft = `${x}px`;
    movedMenu.style.top = localStorage.menuTop = `${y}px`;
  }
}//END f mousemoveMenu


//если мышь отпустили, то меню становится статичным
document.addEventListener("mouseup", event => {if (movedMenu) movedMenu = null}); //END
/// ///

/// /// забрасывание файла на рабочую поверхность
wrapApp.addEventListener("dragover", event => event.preventDefault());

wrapApp.addEventListener("drop", placeDroppedImage);
/// ///

function placeDroppedImage(dropEvent) {
  dropEvent.preventDefault();
  if (image.src !== firstImageSrc) {
    //ошибка, если уже есть размещенное фото
    showHideError(
      true,
      'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.'
    );
    setTimeout(() => showHideError(false), 3000);
    return;
  }
  //проверяем формат перенесенного файла
  if (
    dropEvent.dataTransfer.files[0].type === "image/png" ||
    dropEvent.dataTransfer.files[0].type === "image/jpeg"
  ) {
    sendXHR("POST", dropEvent.dataTransfer.files[0]); //если формат проходит=> отправляем файл на сервер
  } //END if
  else {
    showHideError(
      true,
      "Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png."
    ); // показываем ошибку формата файла
    setTimeout(() => showHideError(false), 3000);
  }
}//END f placeDroppedImage




//загрузка фото на сервер приводит к загрузке фото в <img>
image.addEventListener("load", () => {
  resizeCanvas(); // подгонка канваса под картинку
  resizeCommentsBox(); //подгонка блока комментариев под картинку
  fixMenuBounds();
}); //END
/// ///

///// ///// ///// /////
init();
// инициализация первоначального состояния приложения (обновления)
function init() {
  // проверяем если ли параметры в URL открытой вкладки
  if (getURLid() !== null && history.state === null) {
    //начинаем загружать картинку и инфу по ней с сервера
    sendXHR( "GET", null, getURLid());
    modeItems[1].click(); //включаем режим Комментирования
  } else if (history.state !== null) {
    //если в истории сохранен id, то мы его загружаем с сервера
    //чистим маски и комментарии и канву
    clearImage_Mask_Comments();
    sendXHR( "GET", null, history.state.id);
    modeItems[3].click(); //включаем режим поделиться
  } else {
    // если нет URL id и history.state то обычная загрузка
    menu.dataset.state = "initial"; //первоначальное состояние меню
    modeItems.forEach((elem, index) => elem.dataset.state = "");
    //чистим маски и комментарии и канву
    clearImage_Mask_Comments();
  } //END main else

  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.pointerEvents = "none";
    wrapApp.appendChild(canvas);
    ctx = canvas.getContext("2d");
  }
  /// /// выставляем позицию Меню, с учетом сохраненной ранее позиции
  localStorage.menuLeft
    ? (menu.style.left = localStorage.menuLeft)
    : (menu.style.left = `calc(50% - ${menuBounds.left / 2}px)`);
  localStorage.menuTop
    ? (menu.style.top = localStorage.menuTop)
    : (menu.style.top = `calc(40% - ${menuBounds.height / 2}px)`);

  /// ///создаем input для загрузки файла из диалог окна
  if(!fileInput) createFileInputElement();

} //END f init
///// ///// ///// /////

function createFileInputElement() {
  fileInput = document.createElement("input");
  fileInput.setAttribute("type", "file");
  fileInput.setAttribute("accept", "image/png,image/jpeg"); /// !!! не работает accept атрибут
  fileInput.classList.add("file-input"); // навешиваем класс для инпута
  //добавляем инпут в ДОМ-дерево
  document.querySelector(".new").appendChild(fileInput);
  //слушатель на изменения состояния input
  fileInput.addEventListener("change", fileInputOnChange);
}//END f createFileInputElement

function fileInputOnChange(event) {
  /// делаем проверку MIME типа, так как атрибут accept не фильтрует
  if (
    event.currentTarget.files[0].type === "image/png" ||
    event.currentTarget.files[0].type === "image/jpeg"
  ) {
    sendXHR("POST",event.currentTarget.files[0]); //высылаем файл на сервер, и получаем URL размещенного файла, запоминаем его
  } //END if
  else {
    // показываем ошибку формата файла и прячем ее
    showHideError(
      true,
      "Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png."
    );
    setTimeout(() => showHideError(false), 3000);
  }
}//END f fileInputOnChange

function openWSConnection() {
  //функция создает соединение WebSocket
  WSConnection = new WebSocket(
    `wss://neto-api.herokuapp.com/pic/${placedImageId}`
  );

  WSConnection.addEventListener("error", event => {
    showHideError(true, "Ошибка WebSocket");
    setTimeout(() => showHideError(false), 3000);
  });

  WSConnection.addEventListener("message", event => {
    //в зависимости от типа event, загружаем комменты, или маску
    if (JSON.parse(event.data).event === "comment") {
      handleCommentEvent(JSON.parse(event.data).comment);
    }
    if (JSON.parse(event.data).event === "mask") {
      insertMask(JSON.parse(event.data).url);
    }
  });
} //END f openWSConnection
/// ///

// функция получает true или false - показывает или скрывает ошибку с заданным MESSAGE
function showHideError(status, messageText) {
  if (status) {
    errorDiv.lastElementChild.textContent = messageText;
    errorDiv.style.display = "block";
  } else if (!status) {
    errorDiv.style.display = "none";
  }
} // END f showHideError
/// ///

//функция для восстановления развалившегося меню
function fixMenuBounds() {
  menuBounds = menu.getBoundingClientRect(); // определение текущих границ элемента Меню
  //если высота меню стала больше чем постоянная высота 'элемента меню умноженного на 1.2', значит меню развалилось => мы исправляем позицию меню
  if (
    document.querySelector(".drag").getBoundingClientRect().height * 1.2 <
    menuBounds.height
  ) {
    menu.style.left = 0; //сдвигаем меню в крайнюю левую точку, чтобы узнать его искомую длину
    menuBounds = menu.getBoundingClientRect(); // определение текущих границ элемента Меню
    let delta = window.innerWidth - menuBounds.width; //находим нужный отступ
    menu.style.left = `${delta}px`; //выстраиваем меню в правую часть окна, так чтобы оно не рассыпалось
  }
} //END f fixMenuBounds
/// ///

// функция для очистки загруженной картинки и удаления всех "масок"
function clearImage_Mask_Comments() {
  let images = Array.from(document.querySelectorAll(".current-image"));
  images.shift();
  //удаляем все теги img кроме первого - image
  images.forEach((el, index) => el.remove());
  image.src = "";
  commentsBox.innerHTML = "";
} //END f clearImageAndMask
/// ///

function getURLid() {
  //функция возвращает id картинки из URL вкладки, или null
  let regExpId = /^id=(.)*/;
  let rightURL = location.href.split("?")[1]; //все что после ?
  if (!rightURL) return null; //если нет правой стороны => null
  let idProp = rightURL.split("&").find(el => regExpId.test(el));
  if (!idProp) return null; // если нет поля Id в URL то возвращ null
  return idProp.substr(3); //функция возвращает id
} //END f getURLid
/// ///

function sendXHR(method, droppedFile = null, id = null) {
  //отправляем на сервер удачный файл droppedFile
  if (method === "GET" && !id) return;
  if (method === "GET") placedImageId = id;

  let xhr = new XMLHttpRequest();
  xhr.addEventListener("loadstart", () => {
    //показываем прелоадер
    imageLoaderDiv.style.display = "block";
  });

  xhr.addEventListener("load", () => {
    if (xhr.status === 200) {
      //чистим маски и комментарии от старой картинки
      clearImage_Mask_Comments();
      //сохраняем URL размещенной фотографии
      placedImageId = JSON.parse(xhr.response).id;
      //показываем размещенное фото на рабочей области
      image.src = JSON.parse(xhr.response).url;
      //открываем WS соединение под загруженную картинку
      openWSConnection();

      //начинаем подгружать комменты :
      if (JSON.parse(xhr.response).comments)
        insertComments(JSON.parse(xhr.response).comments);
      // подгружаем маску картинки из ссылки:
      if (JSON.parse(xhr.response).mask)
        insertMask(JSON.parse(xhr.response).mask);

      //т.к. картинка будет загружена на холст, мы создаем новую запись в хистори
      if(method === "POST") {
        history.pushState({ id: placedImageId }, "", `?id=${placedImageId}`);
        modeItems[3].click(); //вызываем режим share
      }
    } else {
      showHideError(true, "Ошибка протокола HTTP"); //
      setTimeout(() => showHideError(false), 3000);
    }
  });

  xhr.addEventListener("loadend", () => {
    imageLoaderDiv.style.display = "none"; //убираем прелоадер
  });

  xhr.addEventListener("error", () => {
    showHideError(true, "Сетевая ошибка."); // показываем ошибку сети события xhr
    setTimeout(() => showHideError(false), 3000);
  });

  if(method === "POST") {
    let formData = new FormData();
    let blobFile = new Blob([droppedFile], { type: droppedFile.type });
    formData.append("title", "Picture");
    formData.append("image", blobFile);

    xhr.open("POST", "https://neto-api.herokuapp.com/pic");
    xhr.send(formData);
  } else if (method === "GET") {
    xhr.open("GET", `https://neto-api.herokuapp.com/pic/${id}`);
    xhr.send();
  }
} //END f sendXHR
///// ///// ///// /////
