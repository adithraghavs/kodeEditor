var kodeEditor = document.querySelector(".kodeEditor");
kodeEditor.innerHTML = `<div class="wrapper">
      <!--editor container: setting width to is important-->
      <div style="width: 50%;">
        <div class="editor">${kodeEditor.innerHTML}</div>
      </div>
      <!--output container: setting width to is important-->
      <div style="width: 50%;">
        <div class="output"></div>
      </div>
      <!--button group-->
      <div style="margin-top: 10px;">
        <button
          type="button"
          class="run-button"
          onclick="runit($($(this).parent().siblings()[0]).children()[0], $($(this).parent().siblings()[1]).children()[0])"
        >
          Run
        </button>
        <button
          type="button"
          class="stop-button"
          onclick="stopit()"
          style="display: none;"
        >
          Stop code
        </button>
      </div>
      </div>`;
//   kodeEditor.innerHTML = `<div style="display: flex; flex-wrap: wrap; border:1px solid black;">
//   <!--editor container: setting width to is important-->
//   <div style="width: 50%;">
//     <div class="editor">print(1000)</div>
//   </div>
//   <!--output container: setting width to is important-->
//   <div style="width: 50%;">
//     <div class="output"></div>
//   </div>
//   <!--button group-->
//   <div style="margin-top: 10px;">
//     <div class="logo">
//         <div style="display: flex; flex-direction: row;">
//             <img src="../../logo.png" alt="Centel" style="height: 50px; width: 50px;">
//             <p>FreeKode</p>
//         </div>
//     </div>
//     <button
//       type="button"
//       class="run-button"
//       onclick="runit($($(this).parent().siblings()[0]).children()[0], $($(this).parent().siblings()[1]).children()[0])"
//     >
//       Run
//     </button>
//     <button
//       type="button"
//       class="stop-button"
//       onclick="stopit()"
//       style="display: none;"
//     >
//       Stop code
//     </button>
//   </div>
// </div>
// <div class="logs"></div>`
function lineCount(watchamacallit) {
  return watchamacallit.split(/\r*\n/).length;
}
const Range = ace.require("ace/range").Range;
const langTools = ace.require("ace/ext/language_tools");
$(document).ready(function () {
  //editor
  $(".editor").each(function (index) {
    const editor = ace.edit(this);
    editor.setTheme("ace/theme/nord_dark");
    editor.session.setMode("ace/mode/python");
    // enable autocompletion and snippets
    editor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: true,
    });
    var staticWordCompleter = {
      getCompletions: function (editor, session, pos, prefix, callback) {
        var wordList = ["foo", "bar", "baz"];
        callback(
          null,
          wordList.map(function (word) {
            return {
              caption: word,
              value: word,
              meta: "static",
            };
          })
        );
      },
    };
    $(this).data("aceObject", editor);
  });

  //console
  $(".output").each(function (index) {
    const output = ace.edit(this);
    output.session.setMode("ace/mode/plain_text");
    output.renderer.setShowGutter(false);
    output.setReadOnly(true);
    $(this).data("aceObject", output);
    output.prevCursorPosition = output.getCursorPosition();

    //restrict cursor after the printed part during input
    output.selection.on("changeCursor", function () {
      const currentPosition = output.getCursorPosition();
      if (currentPosition.row < output.prevCursorPosition.row) {
        output.selection.moveCursorToPosition(output.prevCursorPosition);
      } else if (currentPosition.row == output.prevCursorPosition.row) {
        if (currentPosition.column < output.prevCursorPosition.column) {
          output.selection.moveCursorToPosition(output.prevCursorPosition);
        }
      }
    });

    //prevent selection by double triple click during input
    output.selection.on("changeSelection", function () {
      const anchorPosition = output.selection.getSelectionAnchor();
      const leadPosition = output.selection.getSelectionLead();

      if (
        anchorPosition.row < output.prevCursorPosition.row ||
        leadPosition.row < output.prevCursorPosition.row
      ) {
        output.selection.clearSelection();
      } else if (
        anchorPosition.row == output.prevCursorPosition.row ||
        leadPosition.row == output.prevCursorPosition.row
      ) {
        if (
          anchorPosition.column < output.prevCursorPosition.column ||
          leadPosition.column < output.prevCursorPosition.column
        ) {
          output.selection.clearSelection();
        }
      }
    });
  });

  //prevent selection by drag and drop during input
  $(".output").on(
    "dragstart ondrop dbclick",
    (e) => {
      e.stopImmediatePropagation();
      e.stopPropagation();
      e.preventDefault();
      return false;
    },
    false
  );
});

function builtinRead(x) {
  if (
    Sk.builtinFiles === undefined ||
    Sk.builtinFiles["files"][x] === undefined
  )
    throw "File not found: '" + x + "'";
  return Sk.builtinFiles["files"][x];
}

function runit(editorElem, outputElem) {
  startTime = performance.now();
  $(".run-button").hide(); //hiding every runButton and turning into stop button
  $(".stop-button").show();
  const editor = $(editorElem).data("aceObject");
  const output = $(outputElem).data("aceObject");
  const prog = editor.session.getValue();
  globalThis.program = editor.session.getValue();
  if (startRun) {
    startRun();
  }
  console.log(prog);
  output.session.setValue("");
  Sk.pre = "output";
  Sk.configure({
    inputfun: function () {
      output.setReadOnly(false);
      // the function returns a promise to give a result back later...
      return new Promise(function (resolve, reject) {
        $(outputElem).on("keydown", function (e) {
          if (e.keyCode == 13) {
            e.preventDefault();
            output.setReadOnly(true);
            $(outputElem).off("keydown");
            output.navigateLineEnd();
            const inputText = output.session.getTextRange(
              new Range(
                output.prevCursorPosition.row,
                output.prevCursorPosition.column,
                output.getCursorPosition().row,
                output.getCursorPosition().column
              )
            );
            resolve(inputText);
            console.log(inputText);
            output.insert("\n");
            output.prevCursorPosition = output.getCursorPosition();
            output.session.setUndoManager(new ace.UndoManager()); //resets undo stack
          }
        });

        $(".stop-button").on("click", function (e) {
          $(outputElem).unbind();
          output.setReadOnly(true);
          return resolve();
        });
      });
    },
    output: function (text) {
      endTime = performance.now();
      output.insert(text);
      globalThis.executed = text;
      if (text.search("Error") != -1) {
        alert("amigo!");
      }
      console.log(text);
      output.prevCursorPosition = output.getCursorPosition();
      output.session.setUndoManager(new ace.UndoManager());
    },
    read: builtinRead,
    __future__: Sk.python3,
    execLimit: Number.POSITIVE_INFINITY,
  });

  //(Sk.TurtleGraphics || (Sk.TurtleGraphics = {})).target = "mycanvas"; //for future pupose
  var myPromise = Sk.misceval.asyncToPromise(function () {
    return Sk.importMainWithBody("<stdin>", false, prog, true);
  });
  myPromise.then(
    function (mod) {
      console.log("success");
      $(".run-button").show();
      $(".stop-button").hide();
      globalThis.success = true;
      if (endRun) {
        endRun();
      }
    },
    function (err) {
      globalThis.success = false;
      if (endRun) {
        endRun();
      }
      output.insert(err.toString());
      if (prog.match(/'(.*?)!'/) || prog.match(/"(.*?)!"$/)) {
        output.insert("\nLooks like you're missing a quote or a bracket.");
      } else if (
        err.toString().match(/^NameError: name '(.*?)' is not defined$/)
      ) {
        output.insert(
          "\nLooks like you're calling a variable that doesn't exist."
        );
      } else if (prog.match(/\((.*?)!)/) || prog.match(/"!((.*?)\)/)) {
        output.insert('\nHmm... Aren"t you missing a parenthesis?');
      } else if (prog.match(/^if (.*?) = (.*?):$/)) {
        output.insert("\nWait... Shouldn't you be using double equals?");
      }
      $(".run-button").show();
      $(".stop-button").hide();
    }
  );
}
function stopit() {
  Sk.execLimit = 1; //stop all previous execution

  Sk.timeoutMsg = function () {
    Sk.execLimit = Number.POSITIVE_INFINITY;
    return "Program Terminated";
  };
}