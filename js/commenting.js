//сниппет для создания формы - нового комментария
const commentFormTamplate = `<form class="comments__form" data-coords="24:148" style="top: 148px; left: 24px;">
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

//навешиваем на Картинку слушатель чтобы создавать на ней комменты
image.addEventListener("click", createComment);

function createComment(event) {
  //если включен режим Комментарии то мы создаем новые комментарии при клике
  if (modeItems[1].dataset.state === "selected") {
    if (newComment) {
      //если открыта форма добавления коммента, то двигаем ее
      newComment.style.top = `${event.offsetY}px`;
      newComment.style.left = `${event.offsetX}px`;
      newComment.dataset.coords = `${event.offsetX}:${event.offsetY}`;
    } else {
      //если нет нового коммента в создании, то мы создаем его с нуля с помощью шаблона
      commentsBox.innerHTML += commentFormTamplate;
      newComment = commentsBox.lastElementChild;
      newComment.classList.add("new-com");
      //тут нужно offsetX, offsetY - координаты внутри image
      newComment.style.top = `${event.offsetY}px`;
      newComment.style.left = `${event.offsetX}px`;
      newComment.dataset.coords = `${event.offsetX}:${event.offsetY}`;
    }
  } //END main if
}//END f createComment

commentsBox.addEventListener("click", shrinkComment);

function shrinkComment(event) {
  //если мы кликнули по маркеру, он раскрылся, и это не новая форма добавляения коммента
  if (
    event.target.classList.contains("comments__marker-checkbox") &&
    event.target.checked === true &&
    !event.target.parentElement.classList.contains("new-com")
  ) {
    for (let checkbox of commentsBox.querySelectorAll(
      ".comments__marker-checkbox"
    )) {
      checkbox.checked = false; //все комменты свернули
    }
    event.target.checked = true; //текущий коммент развернули
    if (newComment) {
      //если была открыта форма добавления , то ее закрываем
      newComment.remove();
      newComment = null; //очищаем переменную НОВОГО КОММЕНТАРИЯ
    }
  } //END main if
}//END f shrinkComment

//сворачиваем коммент при нажатии ЗАКРЫТь
commentsBox.addEventListener("click", closeComment);

function closeComment(event) {
  if (event.target.classList.contains("comments__close")) {
    event.preventDefault();
    //сворачиваем всю форму:
    event.target.parentElement.previousElementSibling.checked = false;
    // а если это форма нового коммента, то удаляем ее:
    if (
      event.target.parentElement.parentElement.classList.contains("new-com")
    ) {
      newComment.remove(); // если нажали ЗАКРЫТЬ на новом комменте, то удаляем его
      newComment = null; //очищаем переменную НОВОГО КОММЕНТАРИЯ
    }
  }
}//END f closeComment

// нажатие ОТПРАВИТЬ в форме комментария
commentsBox.addEventListener("click", submitComment);

function submitComment(event) {
  if (event.target.classList.contains("comments__submit")) {
    event.preventDefault();
    //проверяем есть ли набранный текст для нового комментария
    if (event.target.previousElementSibling.previousElementSibling.value) {
      //убираем класс нового комментария
      event.target.parentElement.parentElement.classList.remove("new-com");
      //оставляем коммент раскрытым:
      event.target.parentElement.previousElementSibling.checked = true;
      newComment = null; //очищаем переменную формы добавления
      //отправляем коммент на сервер
      let xhrComment = new XMLHttpRequest();
      let leftValue = `${
        event.target.parentElement.parentElement.dataset.coords.split(":")[0]
      }`;
      let topValue = `${
        event.target.parentElement.parentElement.dataset.coords.split(":")[1]
      }`;
      //создаем body для отправки методом POST:
      let body =
        "message=" +
        encodeURIComponent(
          event.target.previousElementSibling.previousElementSibling.value
        ) +
        "&left=" +
        leftValue +
        "&top=" +
        topValue;
      //очищаем поле ввода комментария
      event.target.previousElementSibling.previousElementSibling.value = "";

      xhrComment.addEventListener("loadstart", () => {
        //показываем прелоадер - смнимаем с div класс hidden
        event.target.previousElementSibling.previousElementSibling.previousElementSibling.classList.toggle(
          "hidden"
        );
      });
      xhrComment.addEventListener("loadend", () => {
        event.target.previousElementSibling.previousElementSibling.previousElementSibling.classList.toggle(
          "hidden"
        );
      });
      xhrComment.addEventListener("error", event => {
        showHideError(true, event.message); //
        setTimeout(() => showHideError(false), 3000);
      });

      xhrComment.addEventListener("load", () => {
        if (xhrComment.status === 200) {
        } else {
          showHideError(
            true,
            "Ошибка протокола HTTP при размещении комментария"
          ); //
          setTimeout(() => showHideError(false), 3000);
        }
      }); //END load listener

      xhrComment.open(
        "POST",
        `https://neto-api.herokuapp.com/pic/${placedImageId}/comments`
      );
      xhrComment.setRequestHeader(
        "Content-Type",
        "application/x-www-form-urlencoded"
      );
      xhrComment.send(body);
    } //END 2 if
  } //END main if
}//END f submitComment

// слушатели на переключателе ПОКАЗАТЬ/СКРЫТЬ комментарии
commentsOn.addEventListener("change", showHideComments);
commentsOff.addEventListener("change", showHideComments);

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
  if (newComment) {
    //если была форма добавления, то закрываем ее
    newComment.remove();
    newComment = null;
  }
} // END f showCheckComments

//функция получает объект состоящий из всех комментариев картинки, и расставляет их по рабочей поверхности:
function insertComments(commentsObject) {
  resizeCommentsBox();
  if (!commentsObject) return;
  let commentsIdsArray = Object.keys(commentsObject);
  commentsIdsArray.forEach(elem => {
    //перебираем комментарии используя массив их Id
    handleCommentEvent(commentsObject[elem]);
  });
} //END f insertComments

//функция обрабатываем объект комментария находит/создает ему форму
function handleCommentEvent(commentData) {
  if (
    document.querySelector(
      `[data-coords="${commentData.left}:${commentData.top}"]`
    )
  ) {
    //если уже есть такая форма в разметке, то делаем:
    placeComment(
      commentData,
      document.querySelector(
        `[data-coords="${commentData.left}:${commentData.top}"]`
      )
    );
  } else {
    //создаем новую форму, заполняем шаблоном, прописываем свойства из события
    commentsBox.innerHTML += commentFormTamplate;
    let newForm = commentsBox.lastElementChild;
    newForm.style.top = `${commentData.top}px`;
    newForm.style.left = `${commentData.left}px`; //!!!эксперимент
    newForm.dataset.coords = `${commentData.left}:${commentData.top}`;
    placeComment(commentData, newForm);
  }
} //END f handleCommentEvent

//функция получает комментарий и форму, куда его надо вставить
function placeComment(commentData, form) {
  let date = new Date(commentData.timestamp);
  let commentsBody = form.querySelector('.comments__body');

  let commentDiv = document.createElement('div');
  commentDiv.innerHTML += `<p class="comment__time">${date.getDate()}.${date.getMonth() +
      1}.${date.getFullYear()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}</p>`;
  commentDiv.classList.add('comment');
  let splittedMessage = commentData.message.split('\\n');
  splittedMessage.forEach(elem => commentDiv.innerHTML += `<p class="comment__message">${elem}</p>`);
  //ниже определяем элемент коммент Лоадера, перед которым вставляем коммент
  let loaderDiv = form.querySelector(".loader").parentElement;
  commentsBody.insertBefore(commentDiv, loaderDiv);
} // END f placeComment

//функция подгоняет размеры элемента commentsBox под элемент image
function resizeCommentsBox() {
  let imageBounds = image.getBoundingClientRect();
  commentsBox.style.left = `${imageBounds.left}px`;
  commentsBox.style.top = `${imageBounds.top}px`;
  commentsBox.height = imageBounds.height;
  commentsBox.width = imageBounds.width;
} //END f resizeClearCanvas
/// ///

///// ///// ///// /////
