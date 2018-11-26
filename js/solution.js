`use strict`;


let wrapApp = document.querySelector('.wrap.app');//главный контейнер
wrapApp.style.position = 'relative';
let menu = document.querySelector('.menu');
let  menuBounds = menu.getBoundingClientRect(); // определение текущих границ элемента Меню
let modeItems = Array.from(document.querySelectorAll('.mode'));//кнопки режимов
let image = document.querySelector('.current-image');//элемент с размещенной картинкой
image.removeAttribute('src');//убираем, чтобы позволить drop file один раз
//чтобы картинка не таскалась по экрану если кликнуть и потянуть:
image.addEventListener('dragstart', event => event.preventDefault());
let placedImageId;//сохраняем сюда ID картинки с сервера
let errorDiv = document.querySelector('.error');
let imageLoaderDiv = document.querySelector('.image-loader');
let movedMenu;//переменная для перетаскивания меню по экрану
let deltaX, deltaY;//переменные для корректировки положения меню при перемещении
let newComment;//переменная хранящая форму добавления комментария
let commentsBox = document.querySelector('.comments-box');
let commentsOn = document.getElementById('comments-on');//кнопки ПОКАЗАТЬ/СКРЫТЬ комментарии
let commentsOff = document.getElementById('comments-off');
let WSConnection;
let canvas;
let ctx;
let drawingColor;// цвет рисования
//сниппет комментария:
let commentFormTamplate = `<form class="comments__form" data-coords="24:148" style="top: 148px; left: 24px;">
        <span class="comments__marker"></span>
        <input type="checkbox" class="comments__marker-checkbox">
        <div class="comments__body">
          <div class="comment hidden">
            <div class="loader">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <textarea class="comments__input" type="text" placeholder="Напишите ответ..."></textarea>
          <input class="comments__close" type="button" value="Закрыть">
          <input class="comments__submit" type="submit" value="Отправить">
        </div>
      </form>`;


///// ///// ///// /////

// вешаем кнопкам-модам листенеры
modeItems.forEach((modeItem, index) => {
  //ФУНКЦИЯ нужна т к ее удаляют у mode new
  modeItem.addEventListener('click', clickOnMode);
});//END
//убираем листенер с мод нью
document.querySelector('.new').removeEventListener('click', clickOnMode);


//листенер клик на модах - ФУНКЦИЯ нужна т к ее удаляют у mode new
function clickOnMode(event) {
  modeItems.forEach((elem, index)=> {
    elem.dataset.state = '';
  });
  event.currentTarget.dataset.state = 'selected';
  menu.dataset.state = 'selected';
  // console.log('event.currentTarget===', event.currentTarget, 'menu===', menu);
}//END clickOnMode
/// ///
//включаем рисование режим
modeItems[2].addEventListener('click', event => {
  canvas.style.pointerEvents = 'auto';//включаем реагирование Канвас
  resizeCanvas();// подгоняем размеры Канвас под картинку
});//END рисование
/// ///

///// ///// ///// /////
/// режим Поделиться, клик, создание ссылки URL с параметрами
modeItems[3].addEventListener('click', event => {
  console.log('mode share clicked');
  // создаем и присваиваем URL с параметрами
  document.querySelector('.menu__url').value = location.href.split('?')[0] + '?id=' + placedImageId;
});
/// слушаетель кнопки КОПИРОВАТЬ
document.querySelector('.menu_copy').addEventListener('click', event => {
  document.querySelector('.menu__url').select(); //выделяем содержимое input элемента
  // ниже копируем в буфер выделенное, и выводим в консоль статус операции
  console.log('buffer ===', document.execCommand('copy'));
});
///// ///// ///// /////

//навесиши слушатели всем input radio выбор цвета
Array.from(document.querySelectorAll('.menu__color')).forEach((menuColor) => {
  menuColor.addEventListener('click', event => {
    fixColor(event.currentTarget.value);//устанавливаем цвет рисования
  });
});// END слушатели для menuColors

fixColor('green');// выставляем первый цвет по умолчанию Зеленый

/// /// нажатие на бургер
document.querySelector('.burger').addEventListener('click', ()=> {
  menu.dataset.state = 'default';
  modeItems.forEach((elem, index)=> {
    elem.dataset.state = '';
  });
  canvas.style.pointerEvents = 'none';//отключаем реакции canvas-элемента
  if(newComment) {
    newComment.remove();//удаляем форму нов коммента
    newComment = null;
  }
});//END burger lisctener
/// ///

/// /// drag & drop of MENU перетаскивание
document.querySelector('.drag').addEventListener('mousedown', (event)=> {
  movedMenu = menu;
  menuBounds = menu.getBoundingClientRect();
  //ниже смещение координат клика мыши от left и top меню
  deltaX = event.pageX - menuBounds.x;
  deltaY = event.pageY - menuBounds.y;
});
document.addEventListener('mousemove', (event)=> {
  if(movedMenu) {
    event.preventDefault();
    let x = event.pageX - deltaX;
    let y = event.pageY - deltaY;

    const minX = 0;
    const minY = 0;
    const maxX = window.innerWidth -
    menuBounds.width;
    const maxY = window.innerHeight - menuBounds.height;

    x = Math.min(x, maxX);
    y = Math.min(y, maxY);
    x = Math.max(x, minX);
    y = Math.max(y, minY);
    //новые вычисленные координаты меню сохраняем в localStorage и в меню
    movedMenu.style.left = localStorage.menuLeft = `${x}px`;
    movedMenu.style.top = localStorage.menuTop = `${y}px`;

  }//END if
});//END mousemove listener

document.addEventListener('mouseup', event => {
  if(movedMenu) {
      movedMenu = null;
  }//END main if
});//END
/// ///

///// ///// ///// /////
/// /// забрасывание файла на рабочую поверхность
wrapApp.addEventListener('dragover', event => {
  event.preventDefault();
});
wrapApp.addEventListener('drop', dropEvent => {
  dropEvent.preventDefault();
  if(image.src) {//ошибка, если уже есть размещенное фото
    showHideError(true, 'Чтобы загрузить новое изображение, пожалуйста, воспользуйтесь пунктом "Загрузить новое" в меню.');
    setTimeout(()=> showHideError(false),3000);
    return;
  }
  //проверяем формат перенесенного файла
  if(dropEvent.dataTransfer.files[0].type === 'image/png' || dropEvent.dataTransfer.files[0].type === 'image/jpeg') {
    sendDroppedFile(dropEvent.dataTransfer.files[0]);
  }//END if
  else {
    showHideError(true, 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.');// показываем ошибку формата файла
    setTimeout(()=> showHideError(false),3000);
  }
});//END drop listener
/// ///



//загрузка фото на сервер приводит к загрузке фото в <img> . Здесь 'load' запускает режим кликом по DOM-el share
image.addEventListener('load', ()=> {
  modeItems[3].click();//вызываем режим share
  resizeCanvas();// подгонка канваса под картинку
});//END
/// ///

///// ///// ///// ///// Функционал добавления комментариев Пользователем
//навешиваем на Картинку слушатель чтобы создавать на ней комменты
image.addEventListener('click', event => {
  console.log('click on image event===', event);
  //если включен режим Комментарии то мы создаем новые комментарии при клике
  if( modeItems[1].dataset.state === 'selected') {
    //если есть новый коммент в процессе создания, то мы ему просто меняем координаты.

    if(newComment) {//если открыта форма добавления коммента, то двигаем ее
      newComment.style.top = `${event.pageY}px`;
      newComment.style.left = `${event.pageX}px`;
      newComment.dataset.coords = `${event.pageX}:${event.pageY}`;
    } else {
      //если нет нового коммента в создании, то мы создаем его с нуля с помощью шаблона
      commentsBox.innerHTML += commentFormTamplate;
      newComment = commentsBox.lastElementChild;
      newComment.classList.add('new-com');
      newComment.style.top = `${event.pageY}px`;
      newComment.style.left = `${event.pageX}px`;
      newComment.dataset.coords = `${event.pageX}:${event.pageY}`;
    }
  }//END main if

});// END image click listener

commentsBox.addEventListener('click', event => {
  //если мы кликнули по маркеру, он раскрылся, и это не новая форма добавляения коммента
  if(event.target.classList.contains('comments__marker-checkbox') && event.target.checked === true && !event.target.parentElement.classList.contains('new-com')) {
    for(let checkbox of commentsBox.querySelectorAll('.comments__marker-checkbox')) {
      checkbox.checked = false;//все комменты свернули
    }
    event.target.checked = true;//текущий коммент развернули
    if(newComment) {//если была открыта форма добавления , то ее закрываем
      newComment.remove();// если нажали ЗАКРЫТЬ на новом комменте, то удаляем его
      newComment = null;//очищаем переменную НОВОГО КОММЕНТАРИЯ
    }
  }//END main if
});// END lisctener

// нажатие ОТПРАВИТЬ в форме комментария
commentsBox.addEventListener('click', event => {
  if(event.target.classList.contains('comments__submit')) {
    event.preventDefault();
    console.log('comment submit clicked!');
    //проверяем есть ли набранный текст для нового комментария
    if(event.target.previousElementSibling.previousElementSibling.value) {

      //убираем класс нового комментария
      event.target.parentElement.parentElement.classList.remove('new-com');//!!! переделать
      //оставляем коммент раскрытым:
      event.target.parentElement.previousElementSibling.checked = true;
      newComment = null;//очищаем переменную формы добавления
      //отправляем коммент на сервер
      let xhrComment = new XMLHttpRequest();
      let leftValue = `${event.target.parentElement.parentElement.dataset.coords.split(':')[0]}`;
      let topValue = `${event.target.parentElement.parentElement.dataset.coords.split(':')[1]}`;
      //создаем body для отправки методом POST:
      let body = 'message=' + encodeURIComponent(event.target.previousElementSibling.previousElementSibling.value) +
        '&left=' + leftValue + '&top=' + topValue;
      console.log('body for POST comment===', body);
      //очищаем поле ввода комментария
      event.target.previousElementSibling.previousElementSibling.value = '';

      xhrComment.addEventListener('loadstart', () => {
        //показываем прелоадер - смнимаем с div класс hidden
        event.target.previousElementSibling.previousElementSibling.previousElementSibling.classList.toggle('hidden');
      });
      xhrComment.addEventListener('loadend', () => {
        event.target.previousElementSibling.previousElementSibling.previousElementSibling.classList.toggle('hidden');
      });
      xhrComment.addEventListener('error', (event)=> {
        showHideError(true, event.message);//
        setTimeout(()=> showHideError(false),3000);
      });

      xhrComment.addEventListener('load', ()=> {
        if(xhrComment.status === 200) {
          console.log('xhrComment.response===', xhrComment.response);
        } else {
          showHideError(true, 'Ошибка протокола HTTP при размещении комментария');//
          setTimeout(()=> showHideError(false),3000);
        }
      });//END load listener

      xhrComment.open('POST', `https://neto-api.herokuapp.com/pic/${placedImageId}/comments`);
      xhrComment.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');
      xhrComment.send(body);

    }//END 2 if
  }//END main if
});// END comments__submit lisctener

//сворачиваем коммент при нажатии ЗАКРЫТь
commentsBox.addEventListener('click', event => {
  if(event.target.classList.contains('comments__close')) {
    event.preventDefault();
    //сворачиваем всю форму:
    event.target.parentElement.previousElementSibling.checked = false;
    // а если это форма нового коммента, то удаляем ее:
    if(event.target.parentElement.parentElement.classList.contains('new-com')) {
      newComment.remove();// если нажали ЗАКРЫТЬ на новом комменте, то удаляем его
      newComment = null;//очищаем переменную НОВОГО КОММЕНТАРИЯ
    }
  }
});// END comments__close lisctener
/// ///

// слушатели на переключателе ПОКАЗАТЬ/СКРЫТЬ комментарии
commentsOn.addEventListener('change', showHideComments);
commentsOff.addEventListener('change', showHideComments);

/// функция проверяет статус radiobutton-On, показывающего комментарии
function showHideComments() {
  //при смены состояния удаляем форму добавления коммента
  if (commentsOn.checked) {
    //если стоит переключатель ПОКАЗАТЬ, то блок комментариев виден
    commentsBox.style.opacity = 1;
  } else {
    //если стоит переключатель СКРЫТЬ, то блок комментариев НЕ виден
    commentsBox.style.opacity = 0;
  }
  if(newComment) {//если была форма добавления, то закрываем ее
    newComment.remove();
    newComment = null;
  }
}// END f showCheckComments

/// ///
function handleCommentEvent(commentData) {
  console.log('got commentEventData===', commentData);
  if(document.querySelector(`[data-coords="${commentData.left}:${commentData.top}"]`)) {
    //если уже есть такая форма в разметке, то делаем:
    console.log('выставляем коммент в существующую форму');
    placeComment(commentData, document.querySelector(`[data-coords="${commentData.left}:${commentData.top}"]`));

  } else {
    //создаем новую форму, заполняем шаблоном, прописываем свойства из события
    commentsBox.innerHTML += commentFormTamplate;
    let newForm = commentsBox.lastElementChild;
    newForm.style.top = `${commentData.top}px`;
    newForm.style.left = `${commentData.left}px`;//!!!эксперимент
    newForm.dataset.coords = `${commentData.left}:${commentData.top}`;
    placeComment( commentData, newForm);
  }
}//END f handleCommentEvent

function placeComment(commentData, form) {
  // console.log('получена comment timestamp ===',commentData.timestamp);
  let date = new Date(commentData.timestamp);
  console.log('got comment date===', date);
  //это вставляемый сниппет отправленного коммента
  let commentTamplate = `<div class="comment">
                          <p class="comment__time">${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}</p>
                          <p class="comment__message">${commentData.message}</p>
                        </div>`;
// !!! исправить формат года на XX.XX.XX
  //ниже определяем элемент коммент Лоадера, перед которым вставляем коммент
  let loaderDiv = form.querySelector('.loader').parentElement;
  loaderDiv.insertAdjacentHTML('beforebegin', commentTamplate);
}// END f placeComment

//функция получает объект состоящий из всех комментариев картинки, и расставляет их по рабочей поверхности:
function insertComments(commentsObject) {
  console.log('f insertComments()');
  if(!commentsObject) return;
  let commentsIdsArray = Object.keys(commentsObject);
  commentsIdsArray.forEach(
    (elem) => {
      console.log('inserting comment id===', elem);
      handleCommentEvent(commentsObject[elem]);
    }
  );
}//END f insertComments
///// ///// ///// /////




///// ///// ///// /////
init();
// инициализация первоначального состояния приложения (обновления)
function init() {
// проверяем если ли параметры в URL открытой вкладки
  if(getURLid() !== null) {
    getIdImage(getURLid());
  } else {// если нет URL id то обычная загрузка
      menu.dataset.state = 'initial'; //первоначальное состояние меню
  } //END main else

  canvas = document.createElement('canvas');
  canvas.style.position = 'absolute';
  canvas.style.pointerEvents = 'none';
  wrapApp.appendChild(canvas);
  ctx = canvas.getContext('2d');

  /// /// выставляем позицию Меню, с учетом сохраненной ранее позиции
  localStorage.menuLeft ? menu.style.left = localStorage.menuLeft : menu.style.left = `calc(50% - ${menuBounds.left/2}px)`;
  localStorage.menuTop ? menu.style.top = localStorage.menuTop : menu.style.top = `calc(50% - ${menuBounds.height/2}px)`;

  /// ///создаем input для загрузки файла из диалог окна
  let fileInput = document.createElement('input');
  fileInput.setAttribute('type', 'file');
  fileInput.setAttribute('accept', 'image/png,image/jpeg');/// !!! не работает accept атрибут
  fileInput.classList.add('file-input'); // навешиваем класс для инпута
  //добавляем инпут в ДОМ-дерево
  document.querySelector('.new').appendChild(fileInput);

  fileInput.addEventListener('change', event => {
    console.log('fileInput change===', event.currentTarget.files);
    /// делаем проверку MIME типа, так как атрибут accept не фильтрует
    if(event.currentTarget.files[0].type === 'image/png' || event.currentTarget.files[0].type === 'image/jpeg') {
      sendDroppedFile(event.currentTarget.files[0]); //высылаем файл на сервер, и получаем URL размещенного файла, запоминаем его
    }//END if
    else {
      // показываем ошибку формата файла и прячем ее
      showHideError(true, 'Неверный формат файла. Пожалуйста, выберите изображение в формате .jpg или .png.');
      setTimeout(()=> showHideError(false),3000);
    }
  });//END change listener

}//END f init
///// ///// ///// /////








///// ///// ///// /////Вспомогательные функции


function getURLid() {//функция возвращает id картинки из URL вкладки, или null
  console.log('f getURLid()');
  let regExpId = /^id=(.)*/;
  // location.href.split('?')[1]
  let rightURL = location.href.split('?')[1];//все что после ?
  console.log('rightURL===', rightURL);
  if(!rightURL) return null;//нет правой стороны => null
  let idProp = rightURL.split('&').find((el) => regExpId.test(el));
  if(!idProp) return null;// если нет поля Id то возвращ null
  console.log('idProp===', idProp);
  // console.log('getURLid result===', idProp.substr(3));
  return idProp.substr(3);//возвращаем id
}//END f getURLid

// getURLid();

function getIdImage(id) {//функция получает ID и загружает с сервера данные этой картинки
  if(id === null) {
    return;
  }

  let xhr = new XMLHttpRequest();

  xhr.addEventListener('loadstart', () => {
    //показываем прелоадер
    imageLoaderDiv.style.display = 'block';
  });

  xhr.addEventListener('load', ()=> {

    if(xhr.status === 200) {
      console.log('GET ID IMAGE: xhr.status===',xhr.status, 'xhr.statusText===',xhr.statusText, '\nxhr.response===',xhr.response, '\nxhr.responseText===',xhr.responseText);
      //сохраняем URL размещенной фотографии
      placedImageId = JSON.parse(xhr.response).id;
      console.log('placedImageId assigned===', placedImageId);
      //показываем размещенное фото на рабочей области
      image.src = JSON.parse(xhr.response).url;
      //открываем WS соединение под загруженную картинку
      openWSConnection();
      //начинаем подгружать комменты :
      if(JSON.parse(xhr.response).comments) insertComments(JSON.parse(xhr.response).comments);
      // подгружаем маску картинки из ссылки:
      if(JSON.parse(xhr.response).mask) insertMask(JSON.parse(xhr.response).mask);

    } else {
      showHideError(true, 'Ошибка протокола HTTP');//
      setTimeout(()=> showHideError(false),3000);
    }
  });//END xhr 'load' event

  xhr.addEventListener('loadend', () => {
    imageLoaderDiv.style.display = 'none';//убираем прелоадер
  });

  xhr.addEventListener('error', ()=> {
    showHideError(true, 'Сетевая ошибка.');// показываем ошибку сети события xhr
    setTimeout(()=> showHideError(false),3000);
  });

  xhr.open('GET', `https://neto-api.herokuapp.com/pic/${id}`);
  xhr.send();
}//END getIdImage


function openWSConnection() {//функция создает соединение WebSocket
  console.log('f openWSConnection ()');
  WSConnection = new WebSocket(`wss://neto-api.herokuapp.com/pic/${placedImageId}`);
  WSConnection.addEventListener('open', () => console.log('WSConnection open', WSConnection));
  WSConnection.addEventListener('error', (event) => console.log('WSConnection error===', event.data));

  WSConnection.addEventListener('message', (event) => {
      console.log('WSConnection message===', event.data);
      if(JSON.parse(event.data).event === 'comment') {
        handleCommentEvent(JSON.parse(event.data).comment);
      }
      if(JSON.parse(event.data).event === 'mask') {
        insertMask(JSON.parse(event.data).url);
      }
  });
}//END f openWSConnection

// функция получаем true или false - показывает или скрывает ошибку с заданным MESSAGE
function showHideError(status, messageText) {
  console.log('showHideError() called');
  if(status) {
    errorDiv.lastElementChild.textContent = messageText;
    errorDiv.style.display = 'block';
  } else if(!status) {
    errorDiv.style.display = 'none';
  }
}// END f showHideError

function sendDroppedFile(droppedFile) {//отправляем на сервер удачный файл droppedFile
  let xhr = new XMLHttpRequest();
  let formData = new FormData();
  let blobFile = new Blob([droppedFile], {'type' : droppedFile.type});
  console.log('blobFile created===', blobFile);
  formData.append('title', 'Picture');
  formData.append('image', blobFile);
  //проверка внутренностей форм дейты
  for(let [k,s] of formData) {
    console.log('k=', k, 's=', s);
  }

  xhr.addEventListener('loadstart', () => {
    //показываем прелоадер
    imageLoaderDiv.style.display = 'block';
  });

  xhr.addEventListener('load', ()=> {
    if(xhr.status === 200) {
      console.log('xhr.status===',xhr.status, 'xhr.statusText===',xhr.statusText, '\nxhr.response===',xhr.response, '\nxhr.responseText===',xhr.responseText);
      //сохраняем URL размещенной фотографии
      placedImageId = JSON.parse(xhr.response).id;
      console.log('placedImageId assigned===', placedImageId);
      //показываем размещенное фото на рабочей области
      image.src = JSON.parse(xhr.response).url;
      //открываем WS соединение под загруженную картинку
      openWSConnection();
    } else {
      showHideError(true, 'Ошибка протокола HTTP');//
      setTimeout(()=> showHideError(false),3000);
    }
  });

  xhr.addEventListener('loadend', () => {
    imageLoaderDiv.style.display = 'none';//убираем прелоадер
  });

  xhr.addEventListener('error', ()=> {
    showHideError(true, 'Сетевая ошибка.');// показываем ошибку сети события xhr
    setTimeout(()=> showHideError(false),3000);
  });

  xhr.open('POST', 'https://neto-api.herokuapp.com/pic');
  xhr.send(formData);
  console.log('xhr send');
}//END f sendDroppedFile



///// ///// ///// /////РИСОВАНИЕ в CANVAS
//подгонка размеров Канвас при изменении окна:
window.addEventListener('resize', resizeCanvas);

canvas.addEventListener('mousedown', () => inside = true);
canvas.addEventListener('mousemove', drawMouse);
canvas.addEventListener('mouseleave', () => inside = false);

let inside = false;
let pointX = null;
let pointY = null;

function resizeCanvas() {
  console.log('f resizeCanvas()');
  let imageBounds = image.getBoundingClientRect();

  canvas.style.left = `${imageBounds.left}px`;
  canvas.style.top = `${imageBounds.top}px`;
  canvas.height = imageBounds.height;
  canvas.width = imageBounds.width;
}//END f resizeClearCanvas

function drawMouse(e) {
  //если указатель внутри канвас и нажата левая кнопка:
  if(inside && pointX && isButtonPressed(1, e.buttons)) {

    ctx.beginPath();
    ctx.moveTo(pointX, pointY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.lineWidth = 4;
    ctx.strokeStyle = drawingColor;
    ctx.stroke();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    pointX = e.offsetX;
    pointY = e.offsetY;
    //здесь надо дебаунс функции saveSroke()
    saveStrokeDebounced();
  }
  else {
    pointX = e.offsetX;
    pointY = e.offsetY;
  }
}//END drawMouse

///функция которая выставляет оттенок по переданному значению-строке
function fixColor(color) {
  console.log('fixColor got color===', color);
  switch (color) {
    case 'red':
        drawingColor = '#ea5d56';
    break;
    case 'yellow':
        drawingColor = '#f3d135';
    break;
    case 'green':
        drawingColor = '#6cbe47';
    break;
    case 'blue':
        drawingColor = '#53a7f5';
    break;
    case 'purple':
        drawingColor = '#b36ade';
    break;
  }
}//END f fixColor
//функция проверяющая что нажата левая кнопка мыши
function isButtonPressed(buttonCode, pressed) {
  return (pressed & buttonCode) === buttonCode;
}

function saveStroke() {//функция сохранения фрагмента рисунка пользователя
  console.log('f saveSroke()');
  let base64 = canvas.toDataURL();
  let newImg = image.cloneNode();
  newImg.src = base64;
  newImg.style.pointerEvents = 'none';
  wrapApp.insertBefore(newImg, errorDiv);//добавили слой своего рисунка в разметку
  //отправили фрагмент своего рисунка на сервер
  canvas.toBlob((blobFile)=>{
    WSConnection.send(blobFile);
  });
  //чистим канвас
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}// END f saveSroke

function debounce(callback, delay) {
  let timeout;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(function() {
      timeout = null;
      callback();
    }, delay);
  };
}; //END f debounce

//создаем дебаунс-версию фукнции saveSroke
let saveStrokeDebounced = debounce(saveStroke, 3000);

//функция для вставки маски по URL
function insertMask(maskURL) {
  if(!maskURL) return;
    mask = image.cloneNode();
    mask.style.pointerEvents = 'none';
    mask.src = maskURL;
    wrapApp.insertBefore(mask, errorDiv);//добавили маску в разметку
}//END insertMask

///// ///// ///// /////конец РИСОВАНИЕ
