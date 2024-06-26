import { 
  FC
  , useState
  , useRef
  , useEffect,
} from 'react';
import { useLocation} from 'react-router-dom';
import Konva from 'konva';
import { Stage, Layer } from 'react-konva';
import { ButtonCustomGroup } from './component/ButtonCustomGroup';

import { useTool } from './component/ToolContext';
import { useColor } from './component/ColorContext';

import { Tools } from './component/Tools';

import NavBarRoom from './component/NavBarRoom';

import thumbUpImg from './assets/thumbup.png';
import thumbDownImg from './assets/thumbdown.png'

import "./index.css"

//-----------CRDT---------------------
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { uuidv4 } from 'lib0/random.js';

import { Shape } from './component/UserShape';
// import MindMap, {undoManagerMindMap} from './component/MindMap';
import MindMap from './component/MindMap';
import {Target} from './component/Target';
import {Connector} from './component/Connector';

import { throttle } from 'lodash';
import { ShapeOrder } from './component/ShapeOrder';

/* 블록 하는 좌표 */
let multiSelectBlocker = {
  x1:0,
  y1:0,
  x2:0,
  y2:0,
}

let groupTr:Konva.Transformer | null = null;

const ANK_ALL = [
  'top-left'
  , 'top-center'
  , 'top-right'
  , 'middle-right'
  , 'middle-left'
  , 'bottom-left'
  , 'bottom-center'
  , 'bottom-right'
];

const ANK_MEMO = [
  'top-left'
  , 'top-right'
  , 'bottom-left'
  , 'bottom-right'
];

//Container Components
const App:FC = () => {

  const { tool, setTool } = useTool();
  const { currentColor } = useColor();
  const [clickedIconBtn, setClickedIconBtn] = useState<string | null>(null);
  
  const POSTIT_MIN_WIDTH = 250;  // init size
  const POSTIT_MIN_HEIGHT = 300; // init size

  const [, setIsLoading] = useState(true);

  const stageRef = useRef<Konva.Stage>(null as any);
  const isDrawing = useRef(false);
  const isSelected = useRef(false);
  const isTrans = useRef(false);
  const isDrag = useRef(false);
  const isHand = useRef(false);

  const toolRef = useRef(tool);
  const currentColorRef = useRef<any>();

  // Y.js 관련 상태를 useRef로 관리
  const yDocRef = useRef(new Y.Doc());
  
  //Pen 동작 저장
  const yPens = yDocRef.current.getMap('pens');
  
  //Text 동작 저장
  const yText = yDocRef.current.getMap('text');

  //Trans 동작 저장
  const yTrans = yDocRef.current.getMap('trans');
  
  //Drag move 동작 저장
  const yMove = yDocRef.current.getMap('move');
  
  //Pen 객체 전체 저장
  const yObjects = yDocRef.current.getMap('objects');

  //사용자 마우스 위치 저장
  const yMousePositions = yDocRef.current.getMap('mousePositions');
  
  // 선택 영역 데이터 구조 정의
  const ySelectedNodes = yDocRef.current.getMap('selectedNodes');

  // 객체 순서 저장
  const yOrders = yDocRef.current.getMap('objectOrders');

  // 객체 Lock 저장
  const yLockNodes = yDocRef.current.getMap('lockNodes');
  
  const yTargets: Y.Map<Target> = yDocRef.current.getMap('targets');
  const yConnectors: Y.Map<Connector> = yDocRef.current.getMap('connectors');

  const undoManagerObjRef = useRef<Y.UndoManager | null>(null);
  const undoManagerObj = undoManagerObjRef.current;

  useEffect(() => {
    undoManagerObjRef.current = new Y.UndoManager([yObjects, yConnectors, yTargets]);
  }, []);



  //블록 변수
  let selectionRectangle:Konva.Rect = new Konva.Rect();
  
  let newLine : Konva.Line | null = null;

  let id = uuidv4(); //객체 고유 ID
  
  const userId = useRef("");
  const setUserId = (param:string)=>{
    userId.current = param
  }

  function getRandomColor() {
    const r = Math.floor(Math.random() * 256); // Red 값
    const g = Math.floor(Math.random() * 256); // Green 값
    const b = Math.floor(Math.random() * 256); // Blue 값

    const color = `rgb(${r}, ${g}, ${b})`;
    
    return color;
  }
  
  function updateMousePositionOnScreen(userId:string, mousePosition:any) {    
    let mouseIcon = document.getElementById(`mouse-${userId}`);
    if (!mouseIcon) {
      mouseIcon = document.createElement('div');
      mouseIcon.id = `mouse-${userId}`;
      // 마우스 아이콘 스타일 설정
      mouseIcon.style.position = 'absolute';
      mouseIcon.setAttribute("class", `tool-${Tools[mousePosition.selectTool]}`);
      let mouseUser = document.createElement('p');
      
      mouseUser.textContent = `${userId}`;
      mouseUser.style.minWidth = '100px';
      mouseUser.style.marginTop = '30px';
      mouseUser.style.marginLeft = '10px';
      mouseUser.style.color = 'white';
      mouseUser.style.backgroundColor = getRandomColor()

      mouseIcon.appendChild(mouseUser);
      
      // 사용자별 마우스 아이콘을 구분하기 위한 스타일 추가
      document.body.appendChild(mouseIcon);
    }
    
    const userCurrentTool = Tools[mousePosition.selectTool];
    
    mouseIcon.setAttribute("class", `tool-${userCurrentTool}`);
    mouseIcon.style.left = `${mousePosition.x}px`;
    mouseIcon.style.top = `${mousePosition.y}px`;
  }

  const location = useLocation();
  const { nickname } = location.state || {};

  //load() 역할을 하는 듯
  useEffect(() => {
    setUserId(nickname)

    /* 웹소켓 방식 */
    //const provider = new WebsocketProvider('ws://192.168.1.103:1234', 'drawing-room', yDocRef.current);

    /* 본인 로컬에서 작동 */
    // const provider = new WebrtcProvider('drawing-room', yDocRef.current);

    /* 병철 로컬에서 작동 */
    //const provider = new WebrtcProvider('drawing-room', yDocRef.current, { signaling: ['ws://192.168.1.103:1235'] });
    //const provider = new WebrtcProvider('drawing-room', yDocRef.current, { signaling: ['ws://localhost:1235'] });

    /* 배포시 사용 */
    const provider = new WebrtcProvider('drawing-room', yDocRef.current, { signaling: ['wss://www.jungleweb.monster:1235'] });
    
      

    // Y.js에 저장된 것들 감시하고 업데이트 되면 캔버스에 그리기
    yPens.observe(() => {
      yPens.forEach((konvaData:any, index:string)=>{
        
        const node:any = stageRef.current.children[0].findOne("#"+index)
        if(konvaData.type === 'update' && node != null){
          var newPoints = node.points().concat(konvaData.point);
          node.points(newPoints);
          
        } else if(konvaData.type === 'insert' && node == null){
          const newLine = createNewLine(index, konvaData.points, konvaData.stroke, konvaData.penStyle)
          
          stageRef.current.getLayers()[0].add(newLine);
        } else if(konvaData.type === 'delete' && node != null){
           node.destroy();
           
           
        }
         //yDocRef.current.transact(() => {
           yPens.delete(index);
         //}, undoManagerObj);
      });  
    })
    
   

    //마우스 움직임 감지
    yMousePositions.observe((event) => {
      event.changes.keys.forEach((change, key) => {
        if(key == userId.current) return;
        if (change.action === 'delete') {
          
        } else if (change.action === 'add' || change.action === 'update') {
          const mousePosition:any = yMousePositions.get(key);
          const adjustedPosition = {
            x          : mousePosition.x * stageRef.current.scaleX() + stageRef.current.x(),
            y          : (mousePosition.y-(23 / stageRef.current.scaleY())) * stageRef.current.scaleY() + stageRef.current.y(),
            selectTool : mousePosition.selectTool,
            //scale      : mousePosition.scale
          };
          updateMousePositionOnScreen(key, adjustedPosition);
        }
      });
    });

    //영역 전개 감지
    ySelectedNodes.observe((event) =>{
      event.changes.keys.forEach((change, key)=>{
        if(key == userId.current) return;
        const oldGroup:Konva.Group | undefined = stageRef.current.children[0].findOne(`#area-group-${key}`)
        if(change.action == 'delete'){
          if(!oldGroup) return;
          oldGroup.remove();
        }   
        else if(change.action == 'update'){
          if(!oldGroup) return;
          const userAreaData:any = ySelectedNodes.get(key);
          oldGroup.getChildren().forEach((node:any)=>{
            if(node.getClassName() == Shape.Rect){
              node.width(userAreaData.width);
              node.height(userAreaData.height);
              node.x(userAreaData.x);
              node.y(userAreaData.y);
            }else {
              node.x(userAreaData.x);
              node.y(userAreaData.y-23);
            }

          })
        }
        else if(change.action == 'add'){
          if(oldGroup) return;
          const userAreaData:any = ySelectedNodes.get(key);
          createNewUserArea(key, userAreaData);
        }
      });
    });

    //객체 lock 감지
    yLockNodes.observe((event) =>{
      event.changes.keys.forEach((change, key)=>{
        if(key == userId.current) return;
        if(change.action == 'delete'){
          const serializeData:any = change.oldValue;
          const userLockData:string[] = JSON.parse(serializeData);
          if(userLockData){
            userLockData.forEach((value) => {
              const node = stageRef.current.children[0].findOne("#"+value)
              if(!node) return;
              node.removeName('locked')
            });
          }
        } 
        else if(change.action == 'update'){
        }
        else {
          const serializeData:any = yLockNodes.get(key);
          const userLockData:string[] = JSON.parse(serializeData);
          userLockData.forEach((value) => {
            const node = stageRef.current.children[0].findOne("#"+value)
            if(!node) return;
            node.addName('locked')
          });
        }
      });
    });


    yText.observe(() => {
      yText.forEach((konvaData:any, index:string)=>{
        const node = stageRef.current.children[0].findOne("#"+index)
        let newShape:any;
        if(node) return;
        newShape = createNewText(index, {x: konvaData.x, y: konvaData.y}, konvaData.text)
        stageRef.current.getLayers()[0].add(newShape);
        yText.delete(index);
      });
    });

    yMove.observe((e) => {
      if(e.keysChanged.has('groupChange')){
        yMove.forEach((konvaData:any)=>{
          const paramUserId = konvaData.userId;
          if(paramUserId === userId.current || !userId.current) return;
          const dataList:Array<any> = konvaData.positions;
          
          dataList.forEach((data:any)=>{
            const node:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+data.id)
            if(!node) return;
            node.x(data.x)
            node.y(data.y)
          });

        });
      } else {
        yMove.forEach((konvaData:any, index:string)=>{
          const paramUserId = konvaData.userId;
          if(paramUserId === userId.current || !userId.current) return;
          const node:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+index)
          if(!node) return;
          
          node.x(konvaData.x)
          node.y(konvaData.y)
          yMove.delete(index);
        });
      }
    })

    yTrans.observe((e) => {
      if(e.keysChanged.has('groupChange')){
        yTrans.forEach((konvaData:any)=>{
          const paramUserId = konvaData.userId;
          if(paramUserId === userId.current || !userId.current) return;
          const dataList:Array<any> = konvaData.transformations;

          dataList.forEach((data:any)=>{
            const node:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+data.id)
            if(!node) return;
            node.x(data.x)
            node.y(data.y)
            node.scaleX(data.scaleX)
            node.scaleY(data.scaleY)
            node.rotation(data.rotation)
          });

        });
      } else {
        yTrans.forEach((konvaData:any, index:string)=>{
          const paramUserId = konvaData.userId;
          if(paramUserId === userId.current || !userId.current) return;
          if(e.keysChanged.has('postItTextShape')){
             const nodeText:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+konvaData.id+'_pit');
             const nodeRect:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+konvaData.id+'_pir');
             if(!nodeText || !nodeRect) return;
             nodeText?.height(konvaData.textHeight);
             nodeRect?.height(konvaData.textHeight);
          } else{

            const node:Konva.Node | undefined | null = stageRef.current.children[0].findOne("#"+index)
            if(!node) return;
            node.x(konvaData.x)
            node.y(konvaData.y)
            node.scaleX(konvaData.scaleX)
            node.scaleY(konvaData.scaleY)
            node.rotation(konvaData.rotation)
            
            yTrans.delete(index); 
          }
        });
      }
    })
    yOrders.observe(() => {
      yOrders.forEach((konvaData:any, index:string)=>{
        const paramUserId = konvaData.userId;
        if(paramUserId === userId.current || !userId.current) return;
        const node = stageRef.current.children[0].findOne("#"+index)
        if(!node) return;
        
        switch(konvaData.evt) {
          case ShapeOrder.moveToTop:
          node.moveToTop();
          break;
        case ShapeOrder.moveUp:
          node.moveUp();
          break;
        case ShapeOrder.moveToBottom:
          node.moveToBottom();
          break;
          case ShapeOrder.moveDown:
            node.moveDown();
            break;
        }
      });
    });

        // const initializeCanvas = () => {
    //   yObjects.forEach((konvaData:any, index:string) => {
        
    //     const node = stageRef.current.children[0].findOne("#"+index)
    //     if(node) return;
    //     if(konvaData == null) return;
    //     if(konvaData.type == Shape.Line){
          
    //       const newLine =  createNewLine(index, konvaData.points, konvaData.stroke, konvaData.penStyle)
    //       newLine.visible(false)
    //       stageRef.current.getLayers()[0].add(newLine);
    //       newLine.move({x:konvaData.x, y:konvaData.y});
  
    //       newLine.scaleX(konvaData.scaleX)
    //       newLine.scaleY(konvaData.scaleY)
    //       newLine.rotation(konvaData.rotation)
    //       newLine.visible(true);
    //     } else {
          
    //       if(konvaData.type == Shape.Rect){
    //         const newShape = createNewRect(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill);
    //         newShape.visible(false)
    //         stageRef.current.getLayers()[0].add(newShape);
    //         newShape.scaleX(konvaData.scaleX)
    //         newShape.scaleY(konvaData.scaleY)
    //         newShape.rotation(konvaData.rotation)
    //         newShape.visible(true);
    //       }
    //       else if(konvaData.type == Shape.Circle){
    //         const newShape = createNewCir(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill);
    //         newShape.visible(false)
    //         stageRef.current.getLayers()[0].add(newShape);
    //         newShape.scaleX(konvaData.scaleX)
    //         newShape.scaleY(konvaData.scaleY)
    //         newShape.rotation(konvaData.rotation)
    //         newShape.visible(true);
    //       } 
    //       else if(konvaData.type == Shape.RegularPolygon){
    //         const newShape = createNewTri(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill);
    //         newShape.visible(false)
    //         stageRef.current.getLayers()[0].add(newShape);
    //         newShape.scaleX(konvaData.scaleX)
    //         newShape.scaleY(konvaData.scaleY)
    //         newShape.rotation(konvaData.rotation)
    //         newShape.visible(true);
    //       }
    //       else if(konvaData.type == Shape.Stamp){
    //         let stampImg = new window.Image();
            
    //         stampImg.src = konvaData.image === 'thumbUp' ? thumbUpImg : thumbDownImg;
      
    //         stampImg.onload = () => {
              
    //           const newStamp = createNewStamp(index, {x: konvaData.x, y: konvaData.y}, stampImg)
    //           newStamp.name(konvaData.image)
    //           newStamp.visible(false)
    //           stageRef.current.getLayers()[0].add(newStamp);
    //           newStamp.scaleX(konvaData.scaleX)
    //           newStamp.scaleY(konvaData.scaleY)
    //           newStamp.rotation(konvaData.rotation)
    //           newStamp.visible(true);
    //         }           
    //       } 
    //       else if(konvaData.type == Shape.Group) { 
    //         const newShape = createNewPostIt(index, {x:konvaData.Group.x, y:konvaData.Group.y}, konvaData.Text.text);
    //         newShape.visible(false)
    //         stageRef.current.getLayers()[0].add(newShape);
    //         newShape.scaleX(konvaData.Group.scaleX)
    //         newShape.scaleY(konvaData.Group.scaleY)
    //         newShape.rotation(konvaData.Group.rotation)
    //         newShape.visible(true);
    //       } 
    //       else if(konvaData.type == Shape.Text){
    //         const newShape = createNewText(index, {x: konvaData.x, y: konvaData.y}, konvaData.text)
    //         newShape.visible(false)
    //         stageRef.current.getLayers()[0].add(newShape);
    //         newShape.scaleX(konvaData.scaleX)
    //         newShape.scaleY(konvaData.scaleY)
    //         newShape.rotation(konvaData.rotation)
    //         newShape.visible(true);
    //       }
    //     } 
    //   });
    // };
    
    // const handleDataLoaded = () => {
      
    //   setIsLoading(false);
    //   initializeCanvas();
    //   yObjects.unobserve(handleDataLoaded);
    // };

    // yObjects.observe(handleDataLoaded);

    

    const createNodeFromKonvaData2 = (index: string, konvaData: any) => {
      const node = stageRef.current.children[0].findOne("#"+index)
        if(node) return;
        if(konvaData == null) return;
        if(konvaData.type == Shape.Line){
          
          const newLine =  createNewLine(index, konvaData.points, konvaData.stroke, konvaData.penStyle)
          newLine.visible(false)
          stageRef.current.getLayers()[0].add(newLine);
          newLine.move({x:konvaData.x, y:konvaData.y});
  
          newLine.scaleX(konvaData.scaleX)
          newLine.scaleY(konvaData.scaleY)
          newLine.rotation(konvaData.rotation)
          newLine.visible(true);
        } 
        else {
          
          console.log(konvaData)
          if(konvaData.type == Shape.Rect){
            const newShape = createNewRect(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill, konvaData.stroke);
            newShape.visible(false)
            stageRef.current.getLayers()[0].add(newShape);
            newShape.scaleX(konvaData.scaleX)
            newShape.scaleY(konvaData.scaleY)
            newShape.rotation(konvaData.rotation)
            newShape.visible(true);
          }
          else if(konvaData.type == Shape.Circle){
            const newShape = createNewCir(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill, konvaData.stroke);
            newShape.visible(false)
            stageRef.current.getLayers()[0].add(newShape);
            newShape.scaleX(konvaData.scaleX)
            newShape.scaleY(konvaData.scaleY)
            newShape.rotation(konvaData.rotation)
            newShape.visible(true);
          } 
          else if(konvaData.type == Shape.RegularPolygon){
            const newShape = createNewTri(index, {x:konvaData.x, y:konvaData.y}, konvaData.fill, konvaData.stroke);
            newShape.visible(false)
            stageRef.current.getLayers()[0].add(newShape);
            newShape.scaleX(konvaData.scaleX)
            newShape.scaleY(konvaData.scaleY)
            newShape.rotation(konvaData.rotation)
            newShape.visible(true);
          }
          else  if(konvaData.type === Shape.Stamp || konvaData.type === Shape.Image){
            if(konvaData.image !== 'thumbUp' && konvaData.image !== 'thumbUp'){
              const imageObj = new Image();
              imageObj.onload = () => {
                const newImage = new Konva.Image({
                  id: index,
                  image: imageObj,
                  x: konvaData.x,
                  y: konvaData.y,
                  width: konvaData.width,
                  height: konvaData.height,
                  draggable: true
                });
                
                
                newImage.on("mousedown", (e:any)=>{

                  if(toolRef.current !== Tools.CURSOR){
                    newImage.draggable(false)
                    return;
                  } else {
                    newImage.draggable(true)
                  }

                  const selected = e.target
                  if(groupTr == null){
                    createNewTr();
                  }
                  if(groupTr){
                    if(groupTr.nodes().length == 0){
                      groupTr.nodes([selected]);
                      groupTr.rotateEnabled(true);
                      groupTr.enabledAnchors(ANK_ALL);
                      groupTr.moveToTop();
                    }
                  }
                })

                newImage.visible(false)
                stageRef.current.getLayers()[0].add(newImage);
                newImage.scaleX(konvaData.scaleX)
                newImage.scaleY(konvaData.scaleY)
                newImage.rotation(konvaData.rotation)
                newImage.visible(true);
              };
              imageObj.src = konvaData.image;
            } else {
              let stampImg = new window.Image();
              
              stampImg.src = konvaData.image === 'thumbUp' ? thumbUpImg : konvaData.image === 'thumbDown' ? thumbDownImg : konvaData.image;
              
              stampImg.onload = () => {
                
                const newStamp = createNewStamp(index, {x: konvaData.x, y: konvaData.y}, stampImg)
                newStamp.name(konvaData.image)
                newStamp.visible(false)
                stageRef.current.getLayers()[0].add(newStamp);
                newStamp.scaleX(konvaData.scaleX)
                newStamp.scaleY(konvaData.scaleY)
                newStamp.rotation(konvaData.rotation)
                newStamp.visible(true);
              }           
            }
          } 
          else if(konvaData.type == Shape.Group) { 
            const newShape = createNewPostIt(index, {x:konvaData.Group.x, y:konvaData.Group.y}, konvaData.Text.text);
            newShape.visible(false)
            stageRef.current.getLayers()[0].add(newShape);
            newShape.scaleX(konvaData.Group.scaleX)
            newShape.scaleY(konvaData.Group.scaleY)
            newShape.rotation(konvaData.Group.rotation)
            newShape.moveToTop();
            newShape.visible(true);
          } 
          else if(konvaData.type == Shape.Text){
            const newShape = createNewText(index, {x: konvaData.x, y: konvaData.y}, konvaData.text)
            newShape.visible(false)
            stageRef.current.getLayers()[0].add(newShape);
            newShape.scaleX(konvaData.scaleX)
            newShape.scaleY(konvaData.scaleY)
            newShape.rotation(konvaData.rotation)
            newShape.moveToTop();
            newShape.visible(true);
          }
        } 

    }

    const updateNodeFromKonvaData2 = (index: string, konvaData: any) => {
      const node:any = stageRef.current.children[0].findOne("#" + index);
      if (!node) return;
      if(node.hasName('mindmap'))return;

      if(konvaData.type == Shape.Group){
        node.scaleX(konvaData.Group.scaleX)
        node.scaleY(konvaData.Group.scaleY)
        node.rotation(konvaData.Group.rotation)

      }
      else{
        switch (konvaData.type) {
          case 'Line':
            const lineNode = node as Konva.Line;
            lineNode.points(konvaData.points);
            lineNode.stroke(konvaData.stroke);
            lineNode.strokeWidth(konvaData.strokeWidth);
            lineNode.lineCap(konvaData.lineCap);
            lineNode.lineJoin(konvaData.lineJoin);
            lineNode.tension(konvaData.tension);
            lineNode.opacity(konvaData.opacity);
            
            break;
          case 'Rect':
          case 'Circle':
          case 'RegularPolygon':
            node.stroke(konvaData.stroke),
            node.fill(konvaData.fill);
            break;
          case 'Stamp':
            break;
          case 'Text':
            const textNode = node as Konva.Text;
            textNode.text(konvaData.text);
            //textNode.fontSize(konvaData.fontSize);
            break;
          default:
            break;
        }
      
        // Common properties update
        node.x(konvaData.x);
        node.y(konvaData.y);
        node.scaleX(konvaData.scaleX);
        node.scaleY(konvaData.scaleY);
        node.rotation(konvaData.rotation);
        node.visible(true);
      }
    };
    

    const updateCanvas = () => {
      setIsLoading(false);
      //initializeCanvas();
      yObjects.observe((event) => {

        event.keysChanged.forEach(id => {
          const konvaData = yObjects.get(id);
          let node = stageRef.current.findOne(`#${id}`);
          if (!konvaData && node) {
            if(groupTr){
              groupTr.nodes([]);
              ySelectedNodes.delete(userId.current);
              yLockNodes.delete(userId.current);
              groupTr.rotateEnabled(true);
              groupTr.enabledAnchors(ANK_ALL);
            }
            node?.destroy();
          }
          else if(konvaData && !node){
            createNodeFromKonvaData2(id, konvaData);
          }
          else if(konvaData && node){
            updateNodeFromKonvaData2(id, konvaData);
          }
        });
      });
    };
    updateCanvas();

    // url image drop event--------------------------------------
    const container = document.getElementById('mainContainer');

    container!.addEventListener('dragover', (e) => {
      //기존 이벤트 막아버림
      e.preventDefault();
    });

    container!.addEventListener('drop', (e) => {
      //기존 이벤트 막아버림
      e.preventDefault();

      const layer = stageRef.current.getLayers()[0];
      // 드롭된 이미지의 URL을 추출
      const data = e.dataTransfer!.getData('text/uri-list');
      if (data) {
        const img = new Image();
        img.src = data;
        img.onload = function() {
          const konvaImage = new Konva.Image({
            id : `obj_Id_${id}`,
            x: e.clientX,
            y: e.clientY,
            image: img,
            width: img.width, 
            height: img.height,
            draggable : true,
          });

          konvaImage.on("mousedown", (e:any)=>{

            if(toolRef.current !== Tools.CURSOR){
              konvaImage.draggable(false)
              return;
            } else {
              konvaImage.draggable(true)
            }

            const selected = e.target
            if(groupTr == null){
              createNewTr();
            }
            if(groupTr){
              if(groupTr.nodes().length == 0){
                groupTr.nodes([selected]);
                groupTr.rotateEnabled(true);
                groupTr.enabledAnchors(ANK_ALL);
                groupTr.moveToTop();
              }
            }
          })
    
          layer.add(konvaImage);
          layer.draw();

          const konvaData = {
            id        : konvaImage.id(),
            type      : Shape.Image,
            x         : konvaImage.x(),
            y         : konvaImage.y(),
            scaleX    : konvaImage.scaleX(),
            scaleY    : konvaImage.scaleY(),
            width     : konvaImage.width(),
            height    : konvaImage.height(),
            image     : img.src,
            userId    : userId.current,
            draggable : true
          }
          yDocRef.current.transact(() => {
            yObjects.set(konvaData.id, konvaData);
          }, undoManagerObj);
          id = uuidv4();
        };
      }
    });

    //canvas paste event -------------------
    document.addEventListener('paste', async (e) => {
      const layer = stageRef.current.getLayers()[0];
      let konvaImage:Konva.Image;

      if (e.clipboardData) {
        const items = e.clipboardData.items;
        if (items) {
          for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
              const blob = item.getAsFile();
              if (blob === null)  return ;

              const imageObject = new Image();
              const reader = new FileReader();
              reader.onload = (event) => {
                const result = event.target?.result;
                if (typeof result === 'string') {
                    imageObject.src = result;
                }

                const stage = stageRef.current;
                const stageWidth = stage.width();
                const stageHeight = stage.height();
                const scaleX = stage.scaleX();
                const scaleY = stage.scaleY();
                const stageX = stage.x();
                const stageY = stage.y();

                imageObject.onload = () => {
                  konvaImage = new Konva.Image({
                    id : `obj_Id_${id}`,
                    image: imageObject,
                    width: imageObject.width,
                    height: imageObject.height,
                    draggable : true,
                  });

                  konvaImage.on("mousedown", (e:any)=>{

                    if(toolRef.current !== Tools.CURSOR){
                      konvaImage.draggable(false)
                      return;
                    } else {
                      konvaImage.draggable(true)
                    }

                    const selected = e.target
                    if(groupTr == null){
                      createNewTr();
                    }
                    if(groupTr){
                      if(groupTr.nodes().length == 0){
                        groupTr.nodes([selected]);
                        groupTr.rotateEnabled(true);
                        groupTr.enabledAnchors(ANK_ALL);
                        groupTr.moveToTop();
                      }
                    }
                  })

                  const centerX = (-stageX + stageWidth / 2) / scaleX - imageObject.width / 2;
                  const centerY = (-stageY + stageHeight / 2) / scaleY - imageObject.height /2;

                  konvaImage.x(centerX)
                  konvaImage.y(centerY)

                  layer.add(konvaImage);
                  layer.draw();
                  
                  const konvaData = {
                    id        : konvaImage.id(),
                    type      : Shape.Image,
                    x         : konvaImage.x(),
                    y         : konvaImage.y(),
                    scaleX    : konvaImage.scaleX(),
                    scaleY    : konvaImage.scaleY(),
                    width     : konvaImage.width(),
                    height    : konvaImage.height(),
                    image     : imageObject.src,
                    userId    : userId.current,
                    draggable : true
                  }
                  yDocRef.current.transact(() => {
                    yObjects.set(konvaData.id, konvaData);
                  }, undoManagerObj);
                  id = uuidv4();
                };
              };
              reader.readAsDataURL(blob);
            }
          }
        }
      }   
    });


    return () => {      
      yMousePositions.delete(userId.current);
      provider.destroy();
      yDocRef.current.destroy();
    };
  }, []);

  useEffect(() => {
    toolRef.current = tool;
    currentColorRef.current = currentColor;
    Array.from(document.getElementsByClassName('btn-active')).forEach((element:any) => {
      element.classList.remove('btn-active')
    });
    document.getElementById(Tools[tool].toString())?.classList.add('btn-active')
  }, [tool, currentColor]);

  const createNewUserArea = (paramUserId:string, pos:{x:number, y:number, width:number, height:number})=>{
    
    if(pos.width == 0 && pos.height == 0) return;
    
    const newRect = new Konva.Rect({
      id : `area-${paramUserId}`,
      stroke: 'rgba(255,0,0,0.5)',
      strokeWidth : 7,
      visible : true,
    })
    
    const nameTag = new Konva.Text({
      id : `area-tag-${paramUserId}`,
      fill: 'rgba(255,0,0,0.5)',
      fontSize : 20,
      fontStyle : 'bold',
      padding : 2,
      visible : true,
      width: 100,
      height: 100,
      text : `${paramUserId}`
    })
    
    const groups = new Konva.Group({
      id : `area-group-${paramUserId}`,
    })
    
    
    groups.add(newRect);
    groups.add(nameTag);
    
    newRect.x(pos.x)
    newRect.y(pos.y)
    newRect.width(pos.width)
    newRect.height(pos.height)
    
    nameTag.x(pos.x)
    nameTag.y(pos.y-23) 
    
    stageRef.current.getLayers()[0].add(groups);
    
  }
  
  const createNewLine = (idx:string, pos:number[], color:any, penStyle:Tools = Tools.PEN) =>{
    let newLine:Konva.Line;
    
    if(penStyle == Tools.PEN){
      newLine = new Konva.Line({
        id          : idx,
        points      : pos,
        stroke      : color,
        strokeWidth : 5,
        lineCap     : 'round',
        lineJoin    : 'round',
        draggable   : true,
        name        : Tools[Tools.PEN]
      });
    } else {
      newLine = new Konva.Line({
        id          : idx,
        points      : pos,
        stroke      : color,
        strokeWidth : 15,
        lineCap     : "butt",
        lineJoin    : "round",
        draggable   : true,
        tension     : 0.5,
        opacity     : 0.4,
        name        : Tools[Tools.HIGHLIGHTER],
      });
    }

    newLine.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        newLine.draggable(false)
        return;
      } else {
        newLine.draggable(true)
      }

      const selected = e.target
      if(groupTr == null){
        createNewTr();
      } 
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([selected]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
          groupTr.moveToTop();
        }
      }
      
    })
    return newLine
  }

  const createNewStamp = (id:string, pos:{x:number, y:number}, imageObj:any)=>{
    let newStamp = new Konva.Image({
      id     : id,
      x      : pos.x,
      y      : pos.y,
      width  : 50,
      height : 50,
      image  : imageObj,
      draggable : true
    });
      
    newStamp.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        newStamp.draggable(false)
        return;
      } else {
        newStamp.draggable(true)
      }
      
      const selected = e.target
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([selected]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
          groupTr.moveToTop();
        }
      }
    })

    return newStamp;
  }
  
  const createNewRect = (id:string, pos:{x:number, y:number}, color:any, strokeColor:any)=>{

    const newShape = new Konva.Rect({
      id          : id,
      x           : pos.x,
      y           : pos.y,
      width       : 150, 
      height      : 150,
      fill        : color,
      stroke      : strokeColor,
      strokeWidth : 4,
      draggable   : true
    });
    newShape.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        newShape.draggable(false)
        return;
      } else {
        newShape.draggable(true)
      }

      const selected = e.target
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([selected]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
          groupTr.moveToTop();
        }
      }
    })
    return newShape
  }

  const createNewCir = (id:string, pos:{x:number, y:number}, color:any, strokeColor:any)=>{
    const newShape = new Konva.Circle({
      id          : id,
      x           : pos.x,
      y           : pos.y,
      width       : 150, 
      height      : 150,
      fill        : color,
      stroke      : strokeColor,
      strokeWidth : 4,
      draggable   : true
    });

    newShape.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        newShape.draggable(false)
        return;
      } else {
        newShape.draggable(true)
      }

      const selected = e.target
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([selected]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
          
          groupTr.moveToTop();
        }
      }
    })
    return newShape
  }
  
  const createNewTri = (id:string, pos:{x:number, y:number}, color:any, strokeColor:any)=>{
    const newShape = new Konva.RegularPolygon({
      id          : id,
      x           : pos.x,
      y           : pos.y,
      sides       : 3,
      radius      : 100,
      fill        : color,
      stroke      : strokeColor,
      strokeWidth : 4,
      draggable   : true
    });
    
    newShape.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        newShape.draggable(false)
        return;
      } else {
        newShape.draggable(true)
      }

      const selected = e.target
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([selected]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
          groupTr.moveToTop();
        }
      }
    })
    return newShape
  }

  function findFirstDiffIndex(oldStr:string, newStr:string) {
    let start = 0;
    while (start < oldStr.length && start < newStr.length && oldStr[start] === newStr[start]) {
        start++;
    }

    let endOld = oldStr.length - 1;
    let endNew = newStr.length - 1;
    while (endOld >= start && endNew >= start && oldStr[endOld] === newStr[endNew]) {
        endOld--;
        endNew--;
    }

    return { start, endOld: endOld + 1, endNew: endNew + 1 };
  }

  const createNewTextArea:any = (textNode:any, areaPosition:{x:number, y:number})=>{
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const scale = stageRef.current.scaleX();

    textarea.value = textNode.text();
    textarea.style.position = 'absolute';
    textarea.style.top = areaPosition.y + 'px';
    textarea.style.left = areaPosition.x + 'px';
    textarea.style.width = (textNode.width() - textNode.padding() * 2)*scale + 'px';
    textarea.style.height = (textNode.height() - textNode.padding() * 2 + 1)*scale + 'px';
    textarea.style.fontSize = (textNode.fontSize()*scale) + 'px';
    textarea.style.border = 'none';
    textarea.style.padding = '0px';
    textarea.style.margin = '0px';
    textarea.style.overflow = 'hidden';
    textarea.style.background = 'none';
    textarea.style.outline = 'none';
    textarea.style.resize = 'none';
    textarea.style.lineHeight = textNode.lineHeight();
    textarea.style.fontFamily = textNode.fontFamily();
    textarea.style.transformOrigin = 'left top';
    textarea.style.textAlign = textNode.align();
    textarea.style.color = textNode.fill();
    let rotation = textNode.rotation();
    var transform = '';
    if (rotation) {
      transform += 'rotateZ(' + rotation + 'deg)';
    }

    var px = 0;

    var isFirefox =
      navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    if (isFirefox) {
      px += 2 + Math.round(textNode.fontSize() / 20);
    }
    transform += 'translateY(-' + px + 'px)';

    textarea.style.transform = transform;

    // reset height
    textarea.style.height = 'auto';
    // after browsers resized it we can set actual value
    textarea.style.height = textarea.scrollHeight + 3 + 'px';

    textarea.focus();

    return textarea;
  }
  
  const createNewText = (id:string, pos:{x:number, y:number}, text:string , color:string = 'Black')=>{
    const yTextData = yDocRef.current.getText(id);

    const textNode:any = new Konva.Text({
      id : id,
      text: text == ""?'텍스트를 입력하세요':text,
      x: pos.x,
      y: pos.y,
      fontSize: 20,
      fill : color,
      draggable: true,
      width: 200,
    });

    
    
    textNode.on("mousedown", (e:any)=>{
      
      if(toolRef.current !== Tools.CURSOR){
        textNode.draggable(false)
        return;
      } else {
        textNode.draggable(true)
      }
      
      const selected = e.target
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr && groupTr.nodes().length == 0){
        groupTr.nodes([selected]);
        groupTr.rotateEnabled(true);
        groupTr.enabledAnchors(ANK_ALL);
        
        groupTr.moveToTop();
      }
    });
    
    
    let textarea:HTMLTextAreaElement;
    
    yTextData.observe(() => {
      
      textNode.text(yTextData.toString());
    });

      
      textNode.on('dblclick dbltap', () => {
        var textPosition = textNode.absolutePosition();
        textNode.hide();

        var areaPosition = {
          x: stageRef.current.container().offsetLeft + textPosition.x,
          y: stageRef.current.container().offsetTop + textPosition.y,
        };
        
        textarea = createNewTextArea(textNode, areaPosition);
        textarea.value = yTextData.toString();
        
        
        let isComposing = false;
        
        textarea.addEventListener('compositionstart', () => {
          isComposing = true; // 한글 입력 시작
        });
        
        textarea.addEventListener('compositionend', () => {
          isComposing = false; // 한글 입력 완료
          
          syncText(); // 입력 완료 후 동기화 함수 호출
        });
        
        textarea.addEventListener('input', () => {
          if (!isComposing) {
            // 한글 입력이 아니거나 입력이 완료된 경우에만 동기화 진행
            syncText();
          }
        });
        
        const syncText = ()=>{
          const currentText = textarea.value;
          // Y.Text 객체의 현재 내용
          const yCurrentText = yTextData.toString();
          
          const { start, endOld, endNew } = findFirstDiffIndex(yCurrentText, currentText);
          
          if (start !== endOld) {
            yTextData.delete(start, endOld - start);
          }
          
          // 그리고 새로운 문자열을 삽입
          const newText = currentText.substring(start, endNew);
          if (newText.length > 0) {
            yTextData.insert(start, newText);
          }
        }
        
      function removeTextarea() {
        if (!textarea.parentNode) return;
        textarea.parentNode.removeChild(textarea);
        window.removeEventListener('click', handleOutsideClick);
        textNode.show();
    
        const konvaData = {
          type      : Shape.Text, 
          id        : textNode.id(),
          x         : textNode.x(),
          y         : textNode.y(),
          width     : textNode.width(),
          fontSize  : textNode.fontSize(),
          text      : textNode.text(),
          draggable : true,
        }
        
        yDocRef.current.transact(() => {
          yObjects.set(textNode.id(), konvaData);
        }, undoManagerObj);
      }
      
      function setTextareaWidth(newWidth:any) {
        if (!newWidth) {
          // set width for placeholder
          newWidth = textNode.placeholder.length * textNode.fontSize();
        }
        // some extra fixes on different browsers
        var isSafari = /^((?!chrome|android).)*safari/i.test(
          navigator.userAgent
          );
          var isFirefox =
          navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
          if (isSafari || isFirefox) {
            newWidth = Math.ceil(newWidth);
          }
          
          var isEdge =
          document.DOCUMENT_NODE || /Edge/.test(navigator.userAgent);
          if (isEdge) {
            newWidth += 1;
          }
          textarea.style.width = newWidth + 'px';
        }
        
        textarea.addEventListener('keydown', function (e:any) {
          // hide on enter
          // but don't hide on shift + enter
          if (e.key === 'Enter' && !e.shiftKey) {
            textNode.text(textarea.value);
            removeTextarea();
          }
          // on esc do not set value back to node
          if (e.key === 'esc') {
            removeTextarea();
          }
        });
        
        
        textarea.addEventListener('keydown', function () {
          let scale = textNode.getAbsoluteScale().x;
          setTextareaWidth(textNode.width() * scale);
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + textNode.fontSize() + 'px';
      });

      function handleOutsideClick(e:any) {
        if (e.target !== textarea) {
          textNode.text(textarea.value);
          removeTextarea();
          //tr.hide();
        }
      }

      setTimeout(() => {
        window.addEventListener('click', handleOutsideClick);
      });
    });

    textNode.on('transform', () => {
      const scaleX = textNode.scaleX();
      const scaleY = textNode.scaleY();

      textNode.width(textNode.width() * scaleX);
      textNode.scaleX(1);
      textNode.height(textNode.height() * scaleY);
      textNode.scaleY(1);

    });
    return textNode
  }

  const createNewPostIt = (id:string, pos:{x:number, y:number}, text:string = "")=>{
    const yTextData = yDocRef.current.getText(id); //text 동기화 추가
    const defaultString = '무엇이든 작성하세요! 스탬프를 이용해 메모에 대한 투표를 진행할 수도 있습니다. 👍🏽👎🏽';

    let postItGroup = new Konva.Group({
      name : 'postIt',
      x: pos.x,
      y: pos.y,
      draggable: true,
      id: id, // 각각의 포스트잇마다 uuid 잘 찍힘 
    });
    
    const postItOptions = {
      x: 0,
      y: 0,
    }
    
    let postItText: any = new Konva.Text({
      id : id+"_pit",
      name: 'postItText',
      ...postItOptions, // x, y
      width: POSTIT_MIN_WIDTH,
      height: POSTIT_MIN_HEIGHT,
      text: text,
      fontSize: 20,
      padding: 15,
      lineHeight: 1.2,
    });
    let initText = new Konva.Text({
      id : id+"_piit",
      name: 'postItInitText',
      ...postItOptions,
      width: postItText.width(),
      text: defaultString,
      fontSize: 20,
      opacity: 0.4,
      padding: 15,
      lineHeight: 1.2,
    });
    
    let postItRect = new Konva.Rect({
      id : id+"_pir",
      name : "postItRect",
      ...postItOptions,
      width: postItText.width(),
      height: postItText.height(),
      fill: '#FFD966',
      shadowColor: 'black',
      shadowBlur: 15,
      shadowOffsetX: 5,
      shadowOffsetY: 5,
      shadowOpacity: 0.2,
    });  
    
    postItGroup.add(postItRect);
    postItGroup.add(postItText);
    postItGroup.add(initText);
    
    if(text !== ""){
      initText.hide();
    }

    //text 관찰자 추가
    yTextData.observe(() => {
      if(yTextData.toString() ==""){
        initText.show();
      }else{
        initText.hide();
      }
      postItText.text(yTextData.toString());
    });

    postItGroup.on('dblclick dbltap', () => {
      initText.hide();
      postItText.hide();
      
      var textPosition = postItText.absolutePosition();
      
      var areaPosition = {
        x: stageRef.current.container().offsetLeft + textPosition.x,
        y: stageRef.current.container().offsetTop + textPosition.y,
      };
      
      //createNewTextArea 유사한 부분---------------------------
      var textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      const scale = stageRef.current.scaleX();

      textarea.style.position = 'absolute';
      textarea.style.top = areaPosition.y + 'px';
      textarea.style.left = areaPosition.x + 'px';
      textarea.style.width = postItText.width() * scale + 'px';
      textarea.style.height = postItText.height() * scale + 'px';
      textarea.style.fontSize = postItText.fontSize() * scale + 'px';
      textarea.style.border = 'none';
      textarea.style.padding = `${15*scale}px`;
      textarea.style.margin = '0px';
      textarea.style.overflow = 'hidden';
      textarea.style.background = 'none';
      textarea.style.outline = 'none';
      textarea.style.resize = 'none';
      textarea.style.lineHeight = postItText.lineHeight();
      textarea.style.fontFamily = postItText.fontFamily();
      textarea.style.transformOrigin = 'left top';
      textarea.style.textAlign = postItText.align();
      textarea.style.color = postItText.fill();

      const rotation = postItText.rotation();
      var transform = '';

      if (rotation) {
        transform += 'rotateZ(' + rotation + 'deg)';
      }

      var px = 0;
      var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
      if (isFirefox) {
        px += 2 + Math.round(postItText.fontSize() / 20);
      }

      transform += 'translateY(-' + px + 'px)';
      textarea.style.transform = transform;
      
      //creatNewTextArea End-------------------------------

      //Text 동기화 시작---------------------------
      textarea.value = yTextData.toString();

      let isComposing = false;
        
      textarea.addEventListener('compositionstart', () => {
        isComposing = true; // 한글 입력 시작
      });
      
      textarea.addEventListener('compositionend', () => {
        isComposing = false; // 한글 입력 완료
        
        syncText(); // 입력 완료 후 동기화 함수 호출
      });
      
      textarea.addEventListener('input', () => {
        if (!isComposing) {
          // 한글 입력이 아니거나 입력이 완료된 경우에만 동기화 진행
          syncText();
        }
      });
      
      const syncText = ()=>{
        const currentText = textarea.value;
        // Y.Text 객체의 현재 내용
        const yCurrentText = yTextData.toString();
        
        const { start, endOld, endNew } = findFirstDiffIndex(yCurrentText, currentText);
        
        if (start !== endOld) {
          yTextData.delete(start, endOld - start);
        }
        
        // 그리고 새로운 문자열을 삽입
        const newText = currentText.substring(start, endNew);
        if (newText.length > 0) {
          yTextData.insert(start, newText);
        }
      }

      //Text 동기화 끝---------------------------

      function setTextareaWidth(newWidth: any) {
        if (!newWidth) {
          // set width for placeholder
          newWidth = postItText.placeholder.length * postItText.fontSize();
        }
        // some extra fixes on different browsers
        var isSafari = /^((?!chrome|android).)*safari/i.test(
          navigator.userAgent
        );
        var isFirefox =
          navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        if (isSafari || isFirefox) {
          newWidth = Math.ceil(newWidth);
        }

        var isEdge =
          document.DOCUMENT_NODE || /Edge/.test(navigator.userAgent);
        if (isEdge) {
          newWidth += 1;
        }
        textarea.style.width = newWidth + 'px';
      }

      /* 입력되는 텍스트 양에 따른 rect height 증가  */
      textarea.addEventListener('keydown', function (e: any) {
        const text = postItGroup.findOne('.postItText')
        const rect = postItGroup.findOne('.postItRect')

        setTextareaWidth(postItText.width() * scale);
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + postItText.fontSize()* scale + 'px';
        let textareaHeight = (parseInt(textarea.style.height.slice(0, -2)) as any); // 'px' 제거

        if (text && rect) {
          text.setAttrs({
            height: Math.max(textareaHeight / scale, POSTIT_MIN_HEIGHT),
          });

          rect.setAttrs({
            height: text.height(),
          });
        }

        const konvaData = {
          id : postItGroup.id(),
          textHeight : text?.height(),
          userId: userId.current
        }
        yTrans.set('postItTextShape', konvaData)

        const key = e.key.toLowerCase();
        if (key == 'esc' || key == 'escape') {
          postItText.text(textarea.value);
          postItText.show();
          textarea.remove();
          stageRef.current.off('mouseup', handleOutsideClick);

          const konvaData = {
            type  : Shape.Group,
            Group : {
              id        : postItGroup.id(),
              x         : postItGroup.x(),
              y         : postItGroup.y(),
              width     : postItGroup.width(),
              height     : postItGroup.height(),
              draggable : true,
              userId    : userId,
            },
            Rect  : {},
            Text  : {
              text      : postItText.text(),
              fontSize  : postItText.fontSize(),
            } 
          }

          yDocRef.current.transact(() => {
            yObjects.set(postItGroup.id(), konvaData);
          }, undoManagerObj);

        }
      });

      function handleOutsideClick(e: any) {
        if (textarea.value === '') {
          initText.show();
        }

        if (e.target !== textarea) {
          postItText.text(textarea.value);
          postItText.show();
          textarea.remove();
          stageRef.current.off('mouseup', handleOutsideClick);

          const konvaData = {
            type  : Shape.Group,
            Group : {
              id        : postItGroup.id(),
              x         : postItGroup.x(),
              y         : postItGroup.y(),
              width     : postItGroup.width(),
              height     : postItGroup.height(),
              draggable : true,
              userId    : userId,
            },
            Rect  : {},
            Text  : {
              text      : postItText.text(),
              fontSize  : postItText.fontSize(),
            } 
          }
          
          yDocRef.current.transact(() => {
            yObjects.set(postItGroup.id(), konvaData);
          }, undoManagerObj);
        }
      }
      
      if(textarea){
        stageRef.current.on('mouseup', handleOutsideClick);
      }
    });

    postItGroup.on("mousedown", (e:any)=>{
      const text = postItGroup.findOne('.postItText')
      const rect = postItGroup.findOne('.postItRect')
      const init = postItGroup.findOne('.postItInitText')
      if(toolRef.current !== Tools.CURSOR){
        postItGroup.draggable(false)
        return;
      } else {
        postItGroup.draggable(true)
      }

      //const selected = e.target
      const current = e.currentTarget
      if(groupTr == null){
        createNewTr();
      }
      if(groupTr){
        if(groupTr.nodes().length == 0){
          groupTr.nodes([current, text, rect, init]);
          groupTr.rotateEnabled(false);
          groupTr.enabledAnchors(ANK_MEMO);
          groupTr.moveToTop();
        }
      }
    })

    // postItGroup.on('click', ()=>{  // e.target: Text, e.currentTarget: Group 
      
    //   const text = postItGroup.findOne('.postItText')
    //   const rect = postItGroup.findOne('.postItRect')
    //   const init = postItGroup.findOne('.postItInitText')
      
    //   if (text && rect) {
    //     text.on('transform', () => {
    //       text.setAttrs({
    //         width: Math.max(text.width() * text.scaleX(), POSTIT_MIN_WIDTH),
    //         height : Math.max(text.height() * text.scaleY(), POSTIT_MIN_HEIGHT),
    //         scaleX: 1,
    //         scaleY: 1,
    //       });
    
    //       // text의 크기가 변경될 때 rect의 크기도 업데이트
    //       rect.setAttrs({
    //         width: text.width(),
    //         height: text.height(),
    //       });

    //       // text의 너비가 변경될 때 initText의 너비도 업데이트
    //       if (init) {
    //         init.setAttrs({
    //           width: text.width(),
    //         })
    //       }
    //     });
    //   }
    // })
    
    return postItGroup
  }

  const createNewTr = ()=>{
    //if (groupTr != null) return;
    const tr = new Konva.Transformer({ flipEnabled: false });

    tr.on('dragstart', function() {
      isDrag.current = true;
    });
    tr.on('dragmove', function(e:any) {
      //마우스 동기화
      const stage = e.target.getStage();
      
      const pos = stage.getPointerPosition();
      const scale = stage.scaleX(); // 현재 스케일
      const position = stage.position(); // 현재 위치
      
      const realPointerPosition = {
        x: (pos.x - position.x) / stage.scaleX(),
        y: (pos.y - position.y) / stage.scaleY(),
      };
      
      const mousePosition = { 
        x: realPointerPosition.x, 
        y: realPointerPosition.y, 
        selectTool : toolRef.current,
        scale: scale
      };
      
      if(userId.current){
        yMousePositions.set(userId.current, mousePosition);
      }
      
      if(tr.getNodes().length < 30){
        tr.getNodes().forEach((node:any)=>{    
          const changeInfo = {
            idx : node.id(),
            x   : node.x(),
            y   : node.y(),
            userId : userId.current
          }
          
          yMove.set(node.id(), changeInfo);
          
        });
      } else {
        updateGroupPosition(tr.getNodes());
      }
      
      const selectionRect = tr.getClientRect();

      // 선택 영역 정보를 절대 좌표계로 변환하여 저장
      const absoluteSelectionInfo = {
        x: (selectionRect.x - position.x) / scale,
        y: (selectionRect.y - position.y) / scale ,
        width: selectionRect.width / stageRef.current.scaleX(),
        height: selectionRect.height / stageRef.current.scaleY(),
      };
      
      ySelectedNodes.set(userId.current, absoluteSelectionInfo);

    });

   
    tr.on('dragend', function() {
      isDrag.current = false;
      let type:any;
      let konvaData:any;
      tr.getNodes().forEach((node:any)=>{
        type = node.getClassName()
        if(node.name().includes("postIt")){
          if(type === Shape.Group){
            konvaData = {
              type  : type,
              Group : {},
              Rect  : {},
              Text  : {} 
            }
            const childList:Konva.Node[] = node.children;
            if(node.getClassName() == Shape.Group){
              konvaData.Group = {
                draggable : true,
                id        : node.id(),
                x         : node.x(),
                y         : node.y(),
                rotation  : node.rotation(),
                scaleX    : node.scaleX(),
                scaleY    : node.scaleY(),
              }
            }
            childList.forEach((childNode:any)=>{
              if(childNode.getClassName() == Shape.Rect){
                konvaData.Rect = {
                  id        : childNode.id(),
                  x         : childNode.x(),
                  y         : childNode.y(),
                  width     : childNode.width(),
                  height    : childNode.height(),
                  scaleX    : childNode.scaleX(),
                  scaleY    : childNode.scaleY(),
                  rotation  : childNode.rotation(),
                  draggable : true,
                }
              } 
              else if(childNode.getClassName() == Shape.Text){
                if(childNode.hasName("postItText")){
                  konvaData.Text = {
                    id        : childNode.id(),
                    x         : childNode.x(),
                    y         : childNode.y(),
                    width     : childNode.width(),
                    fontSize  : childNode.fontSize(),
                    text      : childNode.text(),
                    scaleX    : childNode.scaleX(),
                    scaleY    : childNode.scaleY(),
                    rotation  : childNode.rotation(),
                    draggable : true,
                  }
                }
              } 
            })
          }
        } else {
          if (type === Shape.Line){
            konvaData = {
              type        : type,
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              points      : node.points(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              lineCap     : node.lineCap(),
              lineJoin    : node.lineJoin(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              tension     : node.tension(),
              opacity     : node.opacity(),
              penStyle    : node.hasName(Tools[Tools.PEN]) ? Tools.PEN : Tools.HIGHLIGHTER,
              draggable   : true,
            }
          } else if(type === Shape.RegularPolygon){
            konvaData = {
              type        : type, 
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              sides       : node.sides(),
              radius      : node.radius(),
              fill        : node.fill(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              draggable   : true,
            }
          } else if (type === Shape.Circle || type === Shape.Rect){
            konvaData = {
              type        : type, 
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              width       : node.width(),
              height      : node.height(),
              fill        : node.fill(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              draggable   : true,
            }
          } else if(type === Shape.Stamp || type === Shape.Image){
            konvaData = {
              type      : type,
              id        : node.id(),
              x         : node.x(),
              y         : node.y(),
              width     : node.width(),
              height    : node.height(),
              image     : node.hasName('thumbUp') || node.hasName('thumbDown') ? node.getName(): node.image().src,
              scaleX    : node.scaleX(),
              scaleY    : node.scaleY(),
              rotation  : node.rotation(),
              draggable : true
            }
          } 
          else if(type == Shape.Text){
            konvaData = {
              type      : type, 
              id        : node.id(),
              x         : node.x(),
              y         : node.y(),
              width     : node.width(),
              fontSize  : node.fontSize(),
              text      : node.text(),
              scaleX    : node.scaleX(),
              scaleY    : node.scaleY(),
              rotation  : node.rotation(),
              draggable : true,
            }
            
          }
        }
        yDocRef.current.transact(() => { 
          yObjects.set(node.id(), konvaData);
        }, undoManagerObj);

      });


    });
    

    tr.on('transformstart', function() {
      isTrans.current = true;

    });
    tr.on('transform', function() {
      if(tr.getNodes().length < 30){

        tr.getNodes().forEach((node:any)=>{        
          const changeInfo = {
            idx      : node.id(),
            x        : node.x(),
            y        : node.y(),
            scaleX   : node.scaleX(),
            scaleY   : node.scaleY(),
            rotation : node.rotation(),
            userId : userId.current
          }
          
          
          yTrans.set(node.id(), changeInfo); 
        });
      } else {
        updateGroupTransformation(tr.getNodes());
      }
      const selectionRect = tr.getClientRect();
      const scale = stageRef.current.scaleX(); // 현재 스케일
      const position = stageRef.current.position(); // 현재 위치 
      
      // 선택 영역 정보를 절대 좌표계로 변환하여 저장
      const absoluteSelectionInfo = {
        x: (selectionRect.x - position.x) / scale,
        y: (selectionRect.y - position.y) / scale ,
        width: selectionRect.width / stageRef.current.scaleX(),
        height: selectionRect.height / stageRef.current.scaleY(),
        
      };
      yDocRef.current.transact(() => {

        ySelectedNodes.set(userId.current, absoluteSelectionInfo);
      }, undoManagerObj);
      //sdfsdf

    });
    tr.on('transformend', function() {
      isTrans.current = false;
      let type:Shape;
      let konvaData:any;
      tr.getNodes().forEach((node:any)=>{
        type = node.getClassName();
        if(node.name().includes("postIt")){
          if(type === Shape.Group){
          //if(type === Shape.Text){ 
          
            konvaData = {type : type}
            const childList:Konva.Node[] = node.children;
            if(node.getClassName() == Shape.Group){
              konvaData.Group = {
                draggable : true,
                id        : node.id(),
                x         : node.x(),
                y         : node.y(),
                rotation  : node.rotation(),
                scaleX    : node.scaleX(),
                scaleY    : node.scaleY(),
                // offsetX   : node.id(),
                // offsetY   : node.id(),
                // skewX     : node.skewX(),
                // skewY     : node.skewY(),
              }
            }
            childList.forEach((childNode:any)=>{
              if(childNode.getClassName() == Shape.Rect){
                konvaData.Rect = {
                  id        : childNode.id(),
                  x         : childNode.x(),
                  y         : childNode.y(),
                  width     : childNode.width(),
                  height    : childNode.height(),
                  scaleX    : childNode.scaleX(),
                  scaleY    : childNode.scaleY(),
                  rotation  : childNode.rotation(),
                  draggable : true,
                }
              } 
              else if(childNode.getClassName() == Shape.Text){
                if(childNode.hasName("postItText")){
                  konvaData.Text = {
                    id        : childNode.id(),
                    x         : childNode.x(),
                    y         : childNode.y(),
                    width     : childNode.width(),
                    fontSize  : childNode.fontSize(),
                    text      : childNode.text(),
                    scaleX    : childNode.scaleX(),
                    scaleY    : childNode.scaleY(),
                    rotation  : childNode.rotation(),
                    draggable : true,
                  }
                }
              } 
            })
          }
        } else {
          if (type === Shape.Line){
            konvaData = {
              type        : type,
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              points      : node.points(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              lineCap     : node.lineCap(),
              lineJoin    : node.lineJoin(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              tension     : node.tension(),
              opacity     : node.opacity(),
              penStyle    : node.hasName(Tools[Tools.PEN]) ? Tools.PEN : Tools.HIGHLIGHTER,
              draggable   : true,
            }
          } else if(type === Shape.RegularPolygon){
            konvaData = { 
              type        : type,
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              sides       : node.sides(),
              radius      : node.radius(),
              fill        : node.fill(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              draggable   : true,
            }
          } else if (type === Shape.Circle || type === Shape.Rect){
            konvaData = { 
              type        : type,
              id          : node.id(),
              x           : node.x(),
              y           : node.y(),
              stroke      : node.stroke(),
              strokeWidth : node.strokeWidth(),
              width       : node.width(),
              height      : node.height(),
              fill        : node.fill(),
              scaleX      : node.scaleX(),
              scaleY      : node.scaleY(),
              rotation    : node.rotation(),
              draggable   : true,
            } 
          } else if(type === Shape.Stamp){
            konvaData = {
              type      : type,
              id        : node.id(),
              x         : node.x(),
              y         : node.y(),
              width     : node.width(),
              height    : node.height(),
              image     : node.hasName('thumbUp') || node.hasName('thumbDown') ? node.getName(): node.image().src, 
              scaleX    : node.scaleX(),
              scaleY    : node.scaleY(),
              rotation  : node.rotation(),
              draggable : true
            }
          } else if(type === Shape.Text){
            konvaData = {
              type      : type, 
              id        : node.id(),
              x         : node.x(),
              y         : node.y(),
              width     : node.width(),
              fontSize  : node.fontSize(),
              text      : node.text(),
              scaleX    : node.scaleX(),
              scaleY    : node.scaleY(),
              rotation  : node.rotation(),
              draggable : true,
            }
          }
        }
        yDocRef.current.transact(() => {
          yObjects.set(node.id(), konvaData)
        }, undoManagerObj);
      });

    });
    

    tr.on('mousedown touchstart', (e) => {
      e.cancelBubble = true;
    });


    groupTr = tr;
    stageRef.current.getLayers()[0].add(groupTr)
  }

  // Throttled function for updating group position
  const updateGroupPosition = throttle((nodes) => {
    const groupChangeInfo = {
      positions: nodes.map((node:any) => ({
        id: node.id(),
        x: node.x(),
        y: node.y(),
      })),
      userId: userId.current
    };

    yMove.set('groupChange', groupChangeInfo);
  }, 80);

  // Throttled function for updating group transformations
  const updateGroupTransformation = throttle((nodes) => {
    const groupChangeInfo = {
      transformations: nodes.map((node:any) => ({
        id: node.id(),
        x: node.x(),
        y: node.y(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
        rotation: node.rotation(),
      })),
      userId: userId.current
    };

    yTrans.set('groupChange', groupChangeInfo);
  }, 80);

  /* stamp, shape에만 사용 */
  const handleIconBtnClick = (id: string) => {
    setClickedIconBtn(id);  // 어떤 IconBtn 클릭했는지 변수 clickIconBtn에 저장
  }


  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition();
    const layers = stage.getLayers();
    const layer = layers[0];
    const scale = stage.scaleX(); // 현재 스케일
    const position = stage.position(); // 현재 위치
    
    const realPointerPosition = {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale,
    };

    const idx:string = "obj_Id_"+(id).toString()

    if(tool === Tools.HAND){
      if (e.target === stage){
        stage.container().style.cursor = 'grabbing';
        //Hand 모드 -> 캔버스 이동
        isHand.current = true;
        stageRef.current.draggable(true)
        
      } 
    } 
    else if (tool === Tools.CURSOR){
      if(e.target === stage){
        const menuNode = document.getElementById('contextMenu')!;
        menuNode.style.display = 'none';
        
        //블록(다중 선택하는 영역) 기능
        if(groupTr != null){
          const oldSelected = groupTr.getNodes();
          oldSelected.forEach((node)=>{
            if(node.hasName('locked')){
              node.removeName("locked")
            }
          });
          yDocRef.current.transact(() => {
            ySelectedNodes.delete(userId.current);
          }, undoManagerObj);
          yLockNodes.delete(userId.current);
          groupTr.nodes([]);
          groupTr.rotateEnabled(true);
          groupTr.enabledAnchors(ANK_ALL);
        }
        console.log(groupTr)

        selectionRectangle= new Konva.Rect({
          fill: 'rgba(0,0,255,0.3)',
          visible : true,
          x: realPointerPosition.x,
          y: realPointerPosition.y,
          width: 0,
          height: 0,
        });
      
        
        multiSelectBlocker.x1 = realPointerPosition.x;
        multiSelectBlocker.y1 = realPointerPosition.y;
        multiSelectBlocker.x2 = realPointerPosition.x;
        multiSelectBlocker.y2 = realPointerPosition.y;
        
        selectionRectangle.width(1);
        selectionRectangle.height(1);
        isSelected.current = true;
        layer.add(selectionRectangle)
      } 
      // else {
      //   if(e.target.name() === 'postItInitText' || e.target.name() === 'postItText'){
      //     // groupTr?.borderEnabled(false);
      //     groupTr?.rotateEnabled(false);
      //     // groupTr?.resizeEnabled(false);
      //   } else{
      //   }
      // }
      
    } else if (tool === Tools.PEN || tool === Tools.HIGHLIGHTER) {

      //펜 이벤트
      isDrawing.current = true;

      newLine = createNewLine(idx, [realPointerPosition.x, realPointerPosition.y], currentColorRef.current, toolRef.current)

      layer.add(newLine);
      
      const changeInfo = {
        type: "insert",
        point: [realPointerPosition.x, realPointerPosition.y],
        stroke : newLine.stroke(),
        penStyle: toolRef.current
      };
     
      yPens.set(idx, changeInfo);
     
    }
    else if(tool === Tools.ERASER){
      isDrawing.current = true;
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    
    const pos = stage.getPointerPosition();
    const scale = stage.scaleX(); // 현재 스케일
    const position = stage.position(); // 현재 위치
    
    const realPointerPosition = {
      x: (pos.x - position.x) / stage.scaleX(),
      y: (pos.y - position.y) / stage.scaleY(),
    };

    const mousePosition = { 
      x: realPointerPosition.x, 
      y: realPointerPosition.y, 
      selectTool : toolRef.current,
      scale: scale
    };

    if(userId.current){
      yMousePositions.set(userId.current, mousePosition);
    }

    if(tool === Tools.CURSOR){
      if (!isSelected.current) return;

      //e.evt.preventDefault();
      multiSelectBlocker.x2 = realPointerPosition.x;
      multiSelectBlocker.y2 = realPointerPosition.y;

      selectionRectangle.setAttrs({
        visible : true,
        x: Math.min(multiSelectBlocker.x1, multiSelectBlocker.x2),
        y: Math.min(multiSelectBlocker.y1, multiSelectBlocker.y2),
        width: Math.abs(multiSelectBlocker.x2 - multiSelectBlocker.x1),
        height: Math.abs(multiSelectBlocker.y2 - multiSelectBlocker.y1),
      });
    }
    else if (tool === Tools.HAND){
      
    }
    else if (tool === Tools.PEN ||tool === Tools.HIGHLIGHTER ) {
      if (!isDrawing.current || newLine == null) {
        return;
      }


      var newPoints = newLine.points().concat([realPointerPosition.x, realPointerPosition.y]);
      newLine.points(newPoints);
      
      const idx = "obj_Id_"+(id).toString()

      const changeInfo = {
        type: "update",
        point: [realPointerPosition.x, realPointerPosition.y],
        penStyle : tool
      };
      //yDocRef.current.transact(() => {
        yPens.set(idx, changeInfo);
      //}, undoManagerObj);
    }

  
    else if (tool === Tools.ERASER) {
      if (!isDrawing.current || !stageRef.current) return;
    
      const pos = stageRef.current.getPointerPosition();
      if (!pos) return;
    
      const areaSize = 30;
      const area = {
        x: pos.x - areaSize / 2,
        y: pos.y - areaSize / 2,
        width: areaSize,
        height: areaSize
      };

      const shapes = stageRef.current.getLayers()[0].getChildren((node) => {
        return node instanceof Konva.Shape && !node.hasName('locked');

      });
    
      
    
      const targetErase = shapes.find(node => {
        const shapeRect = node.getClientRect();
        return Konva.Util.haveIntersection(area, shapeRect) && !node.hasName('locked');
      });
    
      if (targetErase) {
        const targetEraseId = targetErase.id();
        
        yDocRef.current.transact(() => {
          if(groupTr != null){
            groupTr.destroy();
            groupTr = null;
          }
          //yselect set 추가해야 할 듯
          yObjects.delete(targetEraseId);
        }, undoManagerObj);
      }
    }
  };

  const handleMouseUp = (e:any) => {
    const leaveEvtFlag:boolean = e.evt.type === 'mouseleave'? true:false  
    const stage = e.target.getStage();

    const scale = stage.scaleX(); // 현재 스케일
    const position = stage.position(); // 현재 위치 

    if(tool === Tools.PEN || tool === Tools.HIGHLIGHTER){
      isDrawing.current = false;
      const idx = "obj_Id_"+(id).toString()
      if(newLine == null) return;
      const konvaData = {
        id          : idx,
        type        : 'Line',
        points      : newLine.points(),
        stroke      : newLine.stroke(),
        strokeWidth : newLine.strokeWidth(),
        lineCap     : newLine.lineCap(),
        lineJoin    : newLine.lineJoin(),
        opacity     : newLine.opacity(),
        tenson      : newLine.tension(),
        penStyle    : tool,
        draggable   : true
      }
      
      yDocRef.current.transact(() => {
        yObjects.set(idx, konvaData)
      }, undoManagerObj); 
      
      
      newLine = null;
      id = uuidv4();
    }
    else if(tool == Tools.ERASER){
      isDrawing.current = false;
    }
    else if(tool === Tools.CURSOR){
      if(isSelected.current){
        isSelected.current = false;
        if (!selectionRectangle.visible()) {
          return;
        }
        
        //e.evt.preventDefault();
        selectionRectangle.visible(false);
        selectionRectangle.destroy();
        var shapes = stageRef.current.find('Shape, Line, Text, Group');
        var box = selectionRectangle.getClientRect();

        const rowSelected: Konva.Node[] = shapes.filter((shape: any) => {
          const shapeNames = shape.name()?.split(' ') || [];
          const intersects = Konva.Util.haveIntersection(box, shape.getClientRect());
          const isMindmap = shapeNames.includes('mindmap');
          return intersects && !isMindmap;
        });
        

        console.log(groupTr, "is grouptr exist?")//TEST
        
          let selected:any[] = [];
          let locksData:string[] = [];
          let rotationFlag = true;
          // if(groupTr == null && rowSelected){
          //   createNewTr(); 
          // }
          
          //groupTr?.nodes([]);
          groupTr?.destroy();
          createNewTr();
          console.log(groupTr, "is grouptr exist?", yTrans)//TEST

          if(groupTr){
            
            rowSelected.forEach((node)=>{
              const nodeId:string = node.id();
              if(!nodeId.includes("area-") && !node.hasName('locked')){
                node.addName("locked");
                selected.push(node);
                locksData.push(nodeId);
                if(node.getClassName() == Shape.Group){
                  rotationFlag = false;
                }
              }
            })
            if(selected.length > 0){
              groupTr.nodes(selected);
              groupTr.rotateEnabled(rotationFlag);
              if(!rotationFlag){
                groupTr.enabledAnchors(ANK_MEMO);
              } else {
                groupTr.enabledAnchors(ANK_ALL);
              }
              groupTr.moveToTop();
              
              const selectionRect = groupTr.getClientRect();

              // 선택 영역 정보를 절대 좌표계로 변환하여 저장
              const absoluteSelectionInfo = {
                x     : (selectionRect.x - position.x) / scale,
                y     : (selectionRect.y - position.y) / scale ,
                width : selectionRect.width / stageRef.current.scaleX(),
                height: selectionRect.height / stageRef.current.scaleY(),
              };
              yDocRef.current.transact(() => {
                ySelectedNodes.set(userId.current, absoluteSelectionInfo);
              }, undoManagerObj);
              yLockNodes.set(userId.current, JSON.stringify(locksData));
            }
          }
          
        } else {
          if(leaveEvtFlag) return;
          
          if(isTrans || isDrag) return ;
          
          const selected = e.target
          if(groupTr == null){
            createNewTr();
          } 
          if(groupTr){
            if(groupTr.nodes().length < 2){
              
              groupTr.nodes([selected]);
            }
          }
        }
    
    }
    else if(tool === Tools.HAND){
      if(e.target === stage){
        e.target.container().style.cursor = 'grab';
        if(isHand){
          isHand.current = false;
          stageRef.current.draggable(false)
        }
      }
    }
  };

  const handleMouseClick = (e: any) => {
    const stage = e.target.getStage()
    const pos = stage.getPointerPosition();
    const layers = stage.getLayers();
    const layer = layers[0];
    const scale = stage.scaleX(); // 현재 스케일
    const position = stage.position(); // 현재 위치
    const idx = "obj_Id_"+(id).toString()
    
    const defaultColor = currentColorRef.current;

    const realPointerPosition = {
      x: (pos.x - position.x) / scale,
      y: (pos.y - position.y) / scale,
    };
    
    const shapeOptions = {
      x: realPointerPosition.x,
      y: realPointerPosition.y,
    }

    
    if(tool === Tools.STAMP){
      let stampImg = new window.Image();
      stampImg.src = clickedIconBtn === 'thumbUp' ? thumbUpImg : thumbDownImg;
      let konvaData : any;
      
      
      stampImg.onload = () => {
        
        /* 클릭 위치에 스탬프 찍기 */
        const newStamp = createNewStamp(idx, shapeOptions, stampImg);
        if(clickedIconBtn){
          newStamp.name(clickedIconBtn);
        }
        konvaData = {
          id        : newStamp.id(),
          type      : Shape.Stamp,
          x         : newStamp.x(),
          y         : newStamp.y(),
          width     : newStamp.width(),
          height    : newStamp.height(),
          image     : clickedIconBtn,
          userId    : userId.current,
          draggable : true
        }
        layer.add(newStamp);
        

        yDocRef.current.transact(() => {
          yObjects.set(idx, konvaData);
        }, undoManagerObj);
        
      }
      
      id = uuidv4();
      setTool(Tools.CURSOR);
    }
    else if (tool === Tools.SHAPE){
      let newShape;
      let konvaData : any;
      
      if (clickedIconBtn === 'rect'){
        newShape = createNewRect(idx, shapeOptions, defaultColor, defaultColor)

        konvaData = {
          id          : newShape.id(),
          type        : Shape.Rect,
          x           : newShape.x(),
          y           : newShape.y(),
          stroke      : newShape.stroke(),
          strokeWidth : newShape.strokeWidth(),
          width       : newShape.width(), 
          height      : newShape.height(),
          fill        : defaultColor,
          userId      : userId.current,
          draggable   : true,
        }
      }
      else if (clickedIconBtn === 'cir') {
        newShape = createNewCir(idx, shapeOptions, defaultColor, defaultColor)

        konvaData = {
          id          : newShape.id(),
          type        : Shape.Circle,
          x           : newShape.x(),
          y           : newShape.y(),
          stroke      : newShape.stroke(),
          strokeWidth : newShape.strokeWidth(),
          width       : newShape.width(), 
          height      : newShape.height(),
          fill        : defaultColor,
          userId      : userId.current,
          draggable   : true
        }
      }
      else if (clickedIconBtn === 'tri') {
        newShape = createNewTri(idx, shapeOptions, defaultColor, defaultColor)
        konvaData = {
          id          : newShape.id(),
          type        : Shape.RegularPolygon,
          x           : newShape.x(),
          y           : newShape.y(),
          stroke      : newShape.stroke(),
          strokeWidth : newShape.strokeWidth(),
          sides       : newShape.sides(),
          radius      : newShape.radius(),
          fill        : defaultColor,
          userId      : userId.current,
          draggable   : true
        }
      }
      layer.add(newShape);

      yDocRef.current.transact(() => {
        yObjects.set(idx, konvaData);
      }, undoManagerObj);
    
      id = uuidv4();
      setTool(Tools.CURSOR);
    } 
    else if (tool === Tools.TEXT) {
      
      var textNode:Konva.Text = createNewText(idx, realPointerPosition, "", defaultColor);
      const konvaData = {
        id       : textNode.id(),
        type     : Shape.Text,
        text     : textNode.text(),
        x        : textNode.x(),
        y        : textNode.y(),
        fill     : textNode.fill(),
        fontSize: textNode.fontSize(),
        draggable: true,
        width: textNode.width(),
        userId    : userId.current,
      }
      layer.add(textNode);
      
      yText.set(idx, konvaData);
      yDocRef.current.transact(() => {
        yObjects.set(idx, konvaData);
      }, undoManagerObj); 
  
    
      
      id = uuidv4();
      setTool(Tools.CURSOR);
    }
    else if (tool === Tools.POSTIT) {
      const postItGroup = createNewPostIt(idx, realPointerPosition, "");

      const konvaData = {
        type  : Shape.Group,
        Group : {
          id        : postItGroup.id(),
          x         : postItGroup.x(),
          y         : postItGroup.y(),
          width     : postItGroup.width(),
          height     : postItGroup.height(),
          draggable : true,
          userId    : userId.current,
        },
        Rect  : {},
        Text  : {
          text      : "",
        } 
      }

      layer.add(postItGroup);

      yDocRef.current.transact(() => {
      
        yObjects.set(idx, konvaData)
      }, undoManagerObj);

      setTool(Tools.CURSOR);
    };    
  }

  const handleMouseWheel = (e: any) => {
    //e.evt.preventDefault();
    const stage = e.target.getStage();

    var oldScale = stage.scaleX();
    var pointer = stage.getPointerPosition();
    var scaleBy = 1.1;

    var mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };

    let direction = e.evt.deltaY > 0 ? 1 : -1;

    if (e.evt.ctrlKey) {
      direction = -direction;
    }

    var newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

    stage.scale({ x: newScale, y: newScale });

    var newPos = {
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    };
    stage.position(newPos);  
  };

  const handleMouseEnter = (e:any)=>{
    const stage = e.target.getStage();
    if(tool === Tools.HAND){
      stage.container().style.cursor = 'grab';
    } else {
      stage.container().style.cursor = 'default';
    }
  }

  const handleMouseLeave = (e:any)=>{
    
    handleMouseUp(e);

    // if(groupTr != null){
    //   groupTr.destroy();
    //   groupTr = null;
    // }

  }

  const handleUndo = () => {
    undoManagerObj?.undo();
  }
  
  const handleRedo = () => {
    undoManagerObj?.redo();
  }

  //--------------ContextMenu-------------------
  //let contextTarget:Konva.Node;
  
  const handleMouseContextMenu = (e: any) => {
    e.evt.preventDefault();
    let menuNode = document.getElementById('contextMenu');
    if (!menuNode) return;
    if (e.target === stageRef.current) return;
    if (tool === Tools.CURSOR){
      if (e.target.hasName('mindmap')) {
        return;
      }
      //contextTarget = e.target
      let fillFlag = false;
      let noFillFlag = false;
      menuNode.style.display = 'block';
      menuNode.style.top = `${e.evt.clientY}px`;
      menuNode.style.left = `${e.evt.clientX}px`;

      if(groupTr){
        if(groupTr.nodes().length > 0){
          groupTr.nodes().forEach((node:any) =>{
            if(node.hasName('postItRect')){
              console.log(node)
            }
            if(node.getClassName() == Shape.Rect || node.getClassName() == Shape.Circle || node.getClassName() == Shape.RegularPolygon){
              if(!node.hasName('postItRect')){
                if(node.fill()){
                  noFillFlag = true;
                } else {
                  fillFlag = true;
                }
              }
            }
          });
        }
        console.log(fillFlag)
        console.log(noFillFlag)
        if(fillFlag){
          // document.getElementById('fill')!.style.display = 'initial'
          document.getElementById('fill')!.removeAttribute('disabled')
          document.getElementById('fill')!.classList.remove('disabled')
        } else {
          // document.getElementById('fill')!.style.display = 'none'
          document.getElementById('fill')!.setAttribute('disabled', 'true')
          document.getElementById('fill')!.classList.add('disabled')
        }
        
        if(noFillFlag){
          // document.getElementById('noFill')!.style.display = 'initial'
          document.getElementById('noFill')!.removeAttribute('disabled')
          document.getElementById('noFill')!.classList.remove('disabled')
        } else {
          // document.getElementById('noFill')!.style.display = 'none'
          document.getElementById('noFill')!.setAttribute('disabled', 'true')
          document.getElementById('noFill')!.classList.add('disabled')
        }

      }

    }

  }

  const foreFrontClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node)=>{
        if(node.hasName('postItText')||node.hasName('postItInitText')||node.hasName('postItRect')) return;
        
        node.moveToTop();
        const konvaData = {
          id : node.id(),
          evt : ShapeOrder.moveToTop,
          userId : userId.current
        }
        
        yOrders.set(konvaData.id, konvaData);
      })
    }
    document.getElementById('contextMenu')!.style.display = 'none';
  }

  const moveTopClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node)=>{
        if(node.hasName('postItText')||node.hasName('postItInitText')||node.hasName('postItRect')) return;
        node.moveUp();
        const konvaData = {
          id : node.id(),
          evt : ShapeOrder.moveUp,
          userId : userId.current
        }
        
        yOrders.set(konvaData.id, konvaData);
      })
    }
    document.getElementById('contextMenu')!.style.display = 'none';
  }
  
  const atTheBackClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node)=>{
        if(node.hasName('postItText')||node.hasName('postItInitText')||node.hasName('postItRect')) return;
        node.moveToBottom();
        const konvaData = {
          id : node.id(),
          evt : ShapeOrder.moveToBottom,
          userId : userId.current
        }
        
        yOrders.set(konvaData.id, konvaData);
      })
    }
    document.getElementById('contextMenu')!.style.display = 'none';
  }
  
  const moveBackClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node)=>{
        if(node.hasName('postItText')||node.hasName('postItInitText')||node.hasName('postItRect')) return;
        node.moveDown();
        const konvaData = {
          id : node.id(),
          evt : ShapeOrder.moveDown,
          userId : userId.current
        }
      
        yOrders.set(konvaData.id, konvaData);
      })
    }
    document.getElementById('contextMenu')!.style.display = 'none';
  }

  const deleteObjClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node)=>{
        node.destroy();
        yObjects.delete(node.id());
      });
      groupTr?.nodes([]);
      ySelectedNodes.delete(userId.current);
      yLockNodes.delete(userId.current);
    }
    document.getElementById('contextMenu')!.style.display = 'none';
  }

  const noFillClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node:any)=>{
        let konvaData = {};
        if(node.getClassName() == Shape.Circle){
          node.fill(null);
          konvaData = {
            id          : node.id(),
            type        : Shape.Circle,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            width       : node.width(), 
            height      : node.height(),
            fill        : null,
            userId      : userId.current,
            draggable   : true,
          }
          yObjects.set(node.id(), konvaData);
        }
        else if( node.getClassName() == Shape.Rect && !node.hasName('postItRect')){
          node.fill(null);
          konvaData = {
            id          : node.id(),
            type        : Shape.Rect,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            width       : node.width(), 
            height      : node.height(),
            fill        : null,
            userId      : userId.current,
            draggable   : true
          }
          yObjects.set(node.id(), konvaData);
        }
        else if(node.getClassName() == Shape.RegularPolygon){
          node.fill(null);
          konvaData = {
            id          : node.id(),
            type        : Shape.RegularPolygon,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            sides       : node.sides(),
            radius      : node.radius(),
            fill        : null,
            userId      : userId.current,
            draggable   : true
          }
          yObjects.set(node.id(), konvaData);
        }
      });
    }
    
    document.getElementById('contextMenu')!.style.display = 'none';
  }
  const fillClick = () => {
    if(groupTr!.nodes().length > 0){
      groupTr!.getNodes().forEach((node:any)=>{
        let konvaData = {};
        if(node.getClassName() == Shape.Circle){
          node.fill(node.stroke());
          konvaData = {
            id          : node.id(),
            type        : Shape.Circle,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            width       : node.width(), 
            height      : node.height(),
            fill        : node.stroke(),
            userId      : userId.current,
            draggable   : true,
          }
          yObjects.set(node.id(), konvaData);
        }
        else if( node.getClassName() == Shape.Rect && !node.hasName('postItRect')){
          node.fill(node.stroke());
          konvaData = {
            id          : node.id(),
            type        : Shape.Rect,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            width       : node.width(), 
            height      : node.height(),
            fill        : node.stroke(),
            userId      : userId.current,
            draggable   : true
          }
          yObjects.set(node.id(), konvaData);
        }
        else if(node.getClassName() == Shape.RegularPolygon){
          node.fill(node.stroke());
          konvaData = {
            id          : node.id(),
            type        : Shape.RegularPolygon,
            x           : node.x(),
            y           : node.y(),
            stroke      : node.stroke(),
            strokeWidth : node.strokeWidth(),
            sides       : node.sides(),
            radius      : node.radius(),
            fill        : node.stroke(),
            userId      : userId.current,
            draggable   : true
          }
          yObjects.set(node.id(), konvaData);
        }
      });
    }
    
    document.getElementById('contextMenu')!.style.display = 'none';
  }


  return (
    <>
    <div id="mainContainer" style={{position: "relative", width: "100%"}}>
      
      <NavBarRoom stageRef = {stageRef} />

      <Stage
        width        = {window.innerWidth}
        height       = {window.innerHeight}
        onMouseEnter = {handleMouseEnter}
        onMouseLeave = {handleMouseLeave}
        onMouseDown  = {handleMouseDown}
        onTouchStart = {handleMouseDown}
        onMouseMove  = {handleMouseMove}
        onTouchMove  = {handleMouseMove}
        onMouseUp    = {handleMouseUp}
        onTouchEnd   = {handleMouseUp}
        onClick      = {handleMouseClick}
        onWheel      = {handleMouseWheel}
        onContextMenu= {handleMouseContextMenu}
        draggable    = {false}
        ref          = {stageRef}
      >
      
        <Layer></Layer>

        <>
          <MindMap stageRef = {stageRef} toolRef={toolRef} yDocRef = {yDocRef} yTargets={yTargets} yConnectors={yConnectors} undoManagerObj={undoManagerObj}/>
        </>
      </Stage>

      <ButtonCustomGroup handleIconBtnClick={handleIconBtnClick} handleUndo={handleUndo} handleRedo={handleRedo}/>
      <div id="contextMenu">
        <div>
          <button id="noFill" onClick={noFillClick}>채우기 없음</button>
          <button id="fill" onClick={fillClick}>색 채우기</button>
          <hr/>
          <button id="foreFront" onClick={foreFrontClick}>맨 앞으로</button>
          <button id="moveTop" onClick={moveTopClick}>앞으로</button>
          <hr/>
          <button id="moveBack" onClick={moveBackClick}>뒤로</button>
          <button id="atTheBack" onClick={atTheBackClick}>맨 뒤로</button>
          <hr/>
          <button id="deleteObj" onClick={deleteObjClick}>삭제</button>
        </div>
      </div>
    </div>
    </>
  );
}

export default App;