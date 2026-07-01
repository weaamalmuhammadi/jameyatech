/* ═══════════════════════════════════════════════════════════
   JameyaTech (جمعيتك) — app.js
   State · i18n · Risk DB · localStorage DB · Screens · Router
═══════════════════════════════════════════════════════════ */
(function () {
'use strict';

// ═══════════════════════════════════════════════════════════
// 1. STATE
// ═══════════════════════════════════════════════════════════
var state = {
  phase:'language', lang:'ar', tab:'circles',
  activeCircleId:null, payMode:'off', notifView:false, loginPhone:'', loginNationalId:'', loginUsername:'', createStep:1,
  settings:{lang:'ar',textSize:'normal',notifPayment:true,notifGroup:true}
};
function setState(u){
  for(var k in u) state[k]=u[k];
  if(u.settings){for(var k2 in u.settings) state.settings[k2]=u.settings[k2]; state.lang=state.settings.lang;}
  render();
}

// ═══════════════════════════════════════════════════════════
// AI AGENT BRIDGE (Flask server wrapping orchestrator.py — see agent_server.py)
// ═══════════════════════════════════════════════════════════
var AGENT_API='http://localhost:5001';
function callAgent(payload,onDone){
  fetch(AGENT_API+'/api/event',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  }).then(function(r){
    return r.json().then(function(data){return {ok:r.ok,data:data};});
  }).then(function(res){
    if(!res.ok||res.data.error) onDone(null,res.data.error||'Request failed');
    else onDone(res.data,null);
  }).catch(function(){
    onDone(null,isA()
      ?'تعذر الاتصال بخدمة الوكلاء الذكية. تأكد من تشغيل agent_server.py على المنفذ 5001.'
      :'Could not reach the AI agent service. Make sure agent_server.py is running on port 5001.');
  });
}

// Shared Risk Agent hook used by both the Create-Circle member form and the
// "Add Member Before Start" form on the circle detail screen.
function runRiskAgentCheck(name,seedRisk,targetElId){
  var l=tt();
  el(targetElId).innerHTML='<p class="ts cm">'+l.riskAgentLoading+'</p>';
  var payload={event_type:'new_member',member_data:{
    name:name||'Member',
    monthly_income:seedRisk?(seedRisk.level==='red'?3000:6000):8000,
    payment_history:seedRisk?(seedRisk.level==='red'?['missed','missed','late_10_days']:['on_time','late_5_days','on_time']):['on_time','on_time','on_time','on_time'],
    months_in_circle_before:seedRisk?1:6
  }};
  callAgent(payload,function(result,err){
    if(err){el(targetElId).innerHTML='<p class="ts cr">'+l.agentErrorPrefix+err+'</p>';return;}
    var risk=(result&&result.result)||{};
    var lvl=risk.risk_level,isR=lvl==='red',isY=lvl==='yellow';
    var bgVar=isR?'var(--red-bg)':(isY?'var(--yellow-bg)':'var(--green-bg)');
    var colorVar=isR?'var(--red)':(isY?'var(--yellow)':'var(--green)');
    el(targetElId).innerHTML='<div class="rsk" style="background:'+bgVar+';border:1.5px solid '+colorVar+'"><div style="font-size:22px;flex-shrink:0">🤖</div><div style="flex:1"><p class="tm b8" style="margin-bottom:4px;color:'+colorVar+'">'+l.riskAgentTitle+'</p><p class="ts ct">'+(risk.reason||'')+'</p></div></div>';
  });
}

// ═══════════════════════════════════════════════════════════
// 2. TRANSLATIONS
// ═══════════════════════════════════════════════════════════
var T={
ar:{
  appName:'جمعيتك',appSub:'JameyaTech',
  chooseLanguage:'اختر لغتك',
  welcomeBack:'أهلاً بك',welcomeSub:'سجّل دخولك للمتابعة',
  nationalIdLabel:'رقم الهوية / الإقامة',nationalIdPH:'1XXXXXXXXX',
  phoneLabel:'رقم الجوال',phonePH:'05XXXXXXXX',
  usernameLabel:'اسم المستخدم',usernamePH:'أدخل اسم المستخدم',
  errNationalId:'يرجى إدخال رقم هوية/إقامة صحيح',
  errUsername:'يرجى إدخال اسم المستخدم',
  sendCode:'إرسال رمز التحقق',enterCode:'أدخل رمز التحقق',
  codeSentTo:'تم إرسال الرمز إلى',verify:'تحقق',resend:'إعادة إرسال',
  nafath:'مدعوم بـ نفاذ',errPhone:'يرجى إدخال رقم صحيح',
  navCircles:'جمعياتي',navCreate:'إنشاء',navSettings:'الإعدادات',
  myCircles:'جمعياتي',noCircles:'ليس لديك جمعيات بعد',
  noCirclesSub:'اضغط على + لإنشاء جمعيتك الأولى',
  roleOrganizer:'منظّم',roleMember:'عضو',
  statusActive:'نشطة',statusWaiting:'بانتظار التأكيد',
  monthlyUnit:'ريال/شهر',myTurnIn:'دوري في',
  daysLeftLabel:function(n){return n+' يوم للدفع'},
  confirmedOf:function(n,t){return n+'/'+t+' أكدوا'},
  backBtn:'← الجمعيات',nextPayment:'الدفع القادم',daysUnit:'يوم',
  currentTurn:'الدور الحالي',
  turnOf:function(n,t){return 'الدور '+n+' من '+t},
  potLabel:'المبلغ هذا الشهر',myTurnLabel:'دوري',
  youReceive:'ستستلم',sarUnit:'ريال',
  allGood:'الجمعية بخير',hasDelay:'هناك تأخير في الدفع',
  handlingIt:function(n){return 'نحن نتواصل مع '+n+' — لا داعي للقلق'},
  membersTitle:'الأعضاء',colJoined:'الانضمام',colPayment:'الدفع',colOrder:'الترتيب',
  confirmed:'مؤكد ✓',pending:'في الانتظار ⏳',declined:'مرفوض ✗',
  paidBadge:'دفع ✓',notPaidBadge:'لم يدفع',youLabel:'(أنت)',
  createTitle:'إنشاء جمعية',
  step1Label:'الخطوة ١ — التفاصيل',step2Label:'الخطوة ٢ — الأعضاء',
  circleNameLabel:'اسم الجمعية',circleNamePH:'مثال: جمعية أصدقاء الرياض',
  amountLabel:'المبلغ الشهري (ريال)',amountPH:'500',
  startDateLabel:'تاريخ بدء الجمعية',
  nextBtn:'التالي ←',backStepBtn:'→ رجوع',
  addMemberTitle:'إضافة عضو',memberNameLabel:'الاسم الكامل',
  memberNamePH:'اسم العضو',memberPhoneLabel:'رقم الجوال',
  memberPhonePH:'05XXXXXXXX',addBtn:'+ إضافة',
  addAnywayBtn:'+ إضافة رغم التحذير',
  addedTitle:'الأعضاء المضافون',noMembersYet:'لم تضف أعضاء بعد',
  removeBtn:'حذف',createBtn:'إنشاء الجمعية',
  errFillAll:'يرجى ملء جميع الحقول',
  errMinMembers:'يجب إضافة عضوين على الأقل',
  successTitle:'تم إنشاء الجمعية! 🎉',
  successSub:'ستصل الدعوات للأعضاء قريباً',goHome:'العودة للجمعيات',
  riskRedTitle:'⚠️ تحذير — عضو عالي المخاطر',
  riskYellowTitle:'⚡ تنبيه — يُنصح بالحذر',
  riskReason:'السبب',riskHistory:'السجل',
  settingsTitle:'الإعدادات',appearanceSection:'المظهر',
  languageLabel:'اللغة',textSizeLabel:'حجم الخط',
  sizeNormal:'عادي',sizeLarge:'كبير',sizeXlarge:'كبير جداً',
  sizePreview:'هذا مثال على حجم الخط',
  notifSection:'الإشعارات',notifPayment:'تذكير الدفع',
  notifGroup:'تحديثات المجموعة',profileSection:'الملف الشخصي',
  nameLabel:'الاسم',phoneLabel2:'رقم الجوال',versionLabel:'الإصدار',
  logoutBtn:'🚪  تسجيل الخروج',nameVal:'وئام',
  // New
  waitingTitle:'الجمعية لم تبدأ بعد',
  waitingDesc:'لا يمكن بدء الجمعية حتى يؤكد جميع الأعضاء انضمامهم.',
  confirmProgress:'تقدم التأكيد',
  turnOrderTitle:'ترتيب الأدوار',
  turnOrderDesc:'اسحب الأعضاء (⠿) لترتيبهم بالطريقة التي تريد أن يستلموا فيها.',
  startCircleBtn:'بدء الجمعية ✓',
  circleStartedTitle:'بدأت الجمعية! 🎉',
  startDateDisplay:'تاريخ البدء',
  readyToStart:'جميع الأعضاء أكدوا — يمكنك بدء الجمعية الآن!',
  exemptBadge:'دوره هذا الشهر',
  addMemberToggle:'+ إضافة عضو',
  payDueTitle:'حان وقت الدفع',
  payDueDesc:'يجب عليك دفع اشتراك هذا الشهر في هذه الجمعية.',
  payNowBtn:'ادفع الآن',
  payScreenTitle:'دفع الاشتراك',amountDueLabel:'المبلغ المطلوب',
  paymentMethodLabel:'طريقة الدفع',methodMada:'مدى',methodApplePay:'Apple Pay',
  confirmPayBtn:'تأكيد الدفع',
  paySuccessTitle:'تم الدفع بنجاح! ✅',
  paySuccessSub:'تم تسجيل دفعتك لهذا الشهر بنجاح.',
  backToCircle:'العودة للجمعية',
  invitationsTitle:'الدعوات',
  inviteDesc:'دُعيت للانضمام إلى هذه الجمعية.',
  acceptBtn:'قبول',declineBtn:'رفض',
  manageCircleTitle:'إدارة الجمعية',
  editPriceBtn:'تعديل',savePriceBtn:'حفظ',cancelBtn:'إلغاء',
  newPriceLabel:'السعر الجديد (ريال)',
  errPrice:'يرجى إدخال مبلغ صحيح',
  priceUpdatedMsg:'✅ تم تحديث السعر وإشعار جميع الأعضاء',
  deleteCircleBtn:'حذف الجمعية',
  deleteConfirmTitle:'هل أنت متأكد؟',
  deleteConfirmDesc:'سيتم حذف هذه الجمعية نهائياً ولا يمكن التراجع عن هذا الإجراء.',
  confirmDeleteBtn:'نعم، احذف الجمعية',
  priceChangeNotif:function(nm,oldA,newA){return 'تم تغيير سعر جمعية «'+nm+'» من '+oldA+' إلى '+newA+' ريال شهرياً.'},
  circleDeletedNotif:function(nm){return 'تم حذف جمعية «'+nm+'».'},
  notificationsTitle:'الإشعارات',noNotifications:'لا توجد إشعارات بعد',
  askRiskAgent:'🤖 اسأل وكيل المخاطر الذكي',
  riskAgentLoading:'جاري تحليل البيانات عبر الوكيل الذكي (Groq)...',
  riskAgentTitle:'تقييم الوكيل الذكي',
  mediateBtn:'🤝 توسّط الوكيل الذكي',
  mediateLoading:'جاري صياغة الحل عبر الوكيل الذكي...',
  mediateMsgTitle:'رسالة الوكيل للعضو',
  restructOptionsTitle:'خيارات إعادة الجدولة',
  draftContractTitle:'مسودة الاتفاق',
  yieldCardTitle:'العائد على المبلغ المجمّع',
  yieldDesc:'احسب العائد المتوقع لاستثمار المبلغ الخامل عبر صندوق سوق نقدي متوافق مع الشريعة (الوكيل الذكي).',
  yieldBtn:'💰 احسب العائد',
  yieldLoading:'جاري حساب العائد عبر الوكيل الذكي...',
  yieldEarnedLabel:'العائد المكتسب',yieldNewTotalLabel:'الإجمالي الجديد',
  agentErrorPrefix:'⚠️ ',
},
en:{
  appName:'JameyaTech',appSub:'جمعيتك',
  chooseLanguage:'Choose your language',
  welcomeBack:'Welcome Back',welcomeSub:'Sign in to continue',
  nationalIdLabel:'National ID / Iqama Number',nationalIdPH:'1XXXXXXXXX',
  phoneLabel:'Mobile Number',phonePH:'05XXXXXXXX',
  usernameLabel:'Username',usernamePH:'Enter your username',
  errNationalId:'Please enter a valid National ID/Iqama number',
  errUsername:'Please enter a username',
  sendCode:'Send Verification Code',enterCode:'Enter Verification Code',
  codeSentTo:'Code sent to',verify:'Verify',resend:'Resend Code',
  nafath:'Powered by Nafath',errPhone:'Please enter a valid number',
  navCircles:'My Circles',navCreate:'Create',navSettings:'Settings',
  myCircles:'My Circles',noCircles:'No circles yet',
  noCirclesSub:'Tap + to create your first circle',
  roleOrganizer:'Organizer',roleMember:'Member',
  statusActive:'Active',statusWaiting:'Awaiting Confirmation',
  monthlyUnit:'SAR/month',myTurnIn:'My turn in',
  daysLeftLabel:function(n){return n+' days to pay'},
  confirmedOf:function(n,t){return n+'/'+t+' confirmed'},
  backBtn:'← Circles',nextPayment:'Next Payment',daysUnit:'Days',
  currentTurn:'Current Turn',
  turnOf:function(n,t){return 'Turn '+n+' of '+t},
  potLabel:'Pot this month',myTurnLabel:'My Turn',
  youReceive:'You will receive',sarUnit:'SAR',
  allGood:'Circle is Healthy',hasDelay:'Payment Delay',
  handlingIt:function(n){return "We're handling it — reaching out to "+n+". No need to worry."},
  membersTitle:'Members',colJoined:'Joined',colPayment:'Payment',colOrder:'Order',
  confirmed:'Confirmed ✓',pending:'Pending ⏳',declined:'Declined ✗',
  paidBadge:'Paid ✓',notPaidBadge:'Not paid',youLabel:'(You)',
  createTitle:'Create New Circle',
  step1Label:'Step 1 — Details',step2Label:'Step 2 — Members',
  circleNameLabel:'Circle Name',circleNamePH:'e.g. Riyadh Friends Circle',
  amountLabel:'Monthly Amount (SAR)',amountPH:'500',
  startDateLabel:'Circle Start Date',
  nextBtn:'Next →',backStepBtn:'← Back',
  addMemberTitle:'Add Member',memberNameLabel:'Full Name',
  memberNamePH:"Member's name",memberPhoneLabel:'Phone Number',
  memberPhonePH:'05XXXXXXXX',addBtn:'+ Add',
  addAnywayBtn:'+ Add Anyway',
  addedTitle:'Added Members',noMembersYet:'No members added yet',
  removeBtn:'Remove',createBtn:'Create Circle',
  errFillAll:'Please fill in all fields',
  errMinMembers:'Please add at least 2 members',
  successTitle:'Circle Created! 🎉',
  successSub:'Invitations will be sent to all members',goHome:'Go to My Circles',
  riskRedTitle:'⚠️ Warning — High Risk Member',
  riskYellowTitle:'⚡ Caution — Proceed Carefully',
  riskReason:'Reason',riskHistory:'History',
  settingsTitle:'Settings',appearanceSection:'Appearance',
  languageLabel:'Language',textSizeLabel:'Text Size',
  sizeNormal:'Normal',sizeLarge:'Large',sizeXlarge:'Extra Large',
  sizePreview:'This is a font size preview',
  notifSection:'Notifications',notifPayment:'Payment reminders',
  notifGroup:'Group updates',profileSection:'My Profile',
  nameLabel:'Name',phoneLabel2:'Phone',versionLabel:'App Version',
  logoutBtn:'🚪  Sign Out',nameVal:'Abdullah',
  // New
  waitingTitle:'Circle Has Not Started',
  waitingDesc:'The circle cannot start until every member confirms.',
  confirmProgress:'Confirmation Progress',
  turnOrderTitle:'Turn Order',
  turnOrderDesc:'Drag members (⠿) to arrange the order in which they receive the pot.',
  startCircleBtn:'Start Circle ✓',
  circleStartedTitle:'Circle Started! 🎉',
  startDateDisplay:'Start Date',
  readyToStart:'All members confirmed — you can start the circle now!',
  exemptBadge:'Receiving this month',
  addMemberToggle:'+ Add Member',
  payDueTitle:'Payment Due',
  payDueDesc:"You need to pay this month's installment for this circle.",
  payNowBtn:'Pay Now',
  payScreenTitle:'Pay Installment',amountDueLabel:'Amount Due',
  paymentMethodLabel:'Payment Method',methodMada:'mada',methodApplePay:'Apple Pay',
  confirmPayBtn:'Confirm Payment',
  paySuccessTitle:'Payment Successful! ✅',
  paySuccessSub:'Your payment for this month has been recorded.',
  backToCircle:'Back to Circle',
  invitationsTitle:'Invitations',
  inviteDesc:"You've been invited to join this circle.",
  acceptBtn:'Accept',declineBtn:'Decline',
  manageCircleTitle:'Manage Circle',
  editPriceBtn:'Edit',savePriceBtn:'Save',cancelBtn:'Cancel',
  newPriceLabel:'New Price (SAR)',
  errPrice:'Please enter a valid amount',
  priceUpdatedMsg:'✅ Price updated and all members notified',
  deleteCircleBtn:'Delete Circle',
  deleteConfirmTitle:'Are you sure?',
  deleteConfirmDesc:'This circle will be permanently deleted. This action cannot be undone.',
  confirmDeleteBtn:'Yes, delete circle',
  priceChangeNotif:function(nm,oldA,newA){return 'The monthly price for "'+nm+'" changed from '+oldA+' to '+newA+' SAR.'},
  circleDeletedNotif:function(nm){return '"'+nm+'" circle has been deleted.'},
  notificationsTitle:'Notifications',noNotifications:'No notifications yet',
  askRiskAgent:'🤖 Ask the AI Risk Agent',
  riskAgentLoading:'Analyzing via the AI agent (Groq)...',
  riskAgentTitle:'AI Agent Assessment',
  mediateBtn:'🤝 Mediate with AI Agent',
  mediateLoading:'Drafting a resolution via the AI agent...',
  mediateMsgTitle:'Agent Message to Member',
  restructOptionsTitle:'Restructuring Options',
  draftContractTitle:'Draft Agreement',
  yieldCardTitle:'Yield on Pooled Funds',
  yieldDesc:'Calculate potential yield from investing the idle pooled amount in a Shariah-compliant money market fund (AI agent).',
  yieldBtn:'💰 Calculate Yield',
  yieldLoading:'Calculating yield via the AI agent...',
  yieldEarnedLabel:'Yield Earned',yieldNewTotalLabel:'New Total',
  agentErrorPrefix:'⚠️ ',
}
};

// ═══════════════════════════════════════════════════════════
// 3. RISK DB
// ═══════════════════════════════════════════════════════════
var RISKS=[
  {phone:'0555000001',ar:'سالم',en:'Salem',level:'red',
   rAr:'تخلف عن الدفع في ٣ جمعيات سابقة.',rEn:'Missed payments in 3 previous circles.',
   hAr:'جمعية العمل (٢٠٢٣) — جمعية الأصدقاء (٢٠٢٤)',hEn:'Work Circle (2023) · Friends Circle (2024)'},
  {phone:'0555000002',ar:'طارق',en:'Tariq',level:'yellow',
   rAr:'دفعة واحدة متأخرة بمقدار ١٥ يوماً.',rEn:'One payment was 15 days late.',
   hAr:'جمعية المكتب (٢٠٢٤)',hEn:'Office Circle (2024)'},
  {phone:'0555000003',ar:'حصة',en:'Hessa',level:'red',
   rAr:'سحب المبلغ وانسحب بدون إشعار.',rEn:'Withdrew payout and left without notice.',
   hAr:'جمعية الحي (٢٠٢٢)',hEn:'Neighborhood Circle (2022)'}
];
function checkRisk(phone){var p=phone.replace(/\s/g,'');for(var i=0;i<RISKS.length;i++){if(RISKS[i].phone===p)return RISKS[i];}return null;}

// ═══════════════════════════════════════════════════════════
// 4. DATABASE
// ═══════════════════════════════════════════════════════════
var DB_KEY='waj_circles',DB_SET='waj_settings';

// status: 'waiting' = not all confirmed, 'active' = started
var SEED=[
  {id:1,ar:'جمعية أصدقاء الرياض',en:'Riyadh Friends Circle',
   myRole:'organizer',amount:500,currentTurn:3,totalTurns:8,myTurn:7,
   myTurnAr:'يوليو',myTurnEn:'July',daysLeft:12,
   startDate:'2025-01-15',status:'active',
   members:[
     {id:1,ar:'أحمد',en:'Ahmed',init:'AG',turn:3,paid:false,confirmed:'confirmed',isMe:false},
     {id:2,ar:'سارة',en:'Sara',init:'SO',turn:1,paid:true,confirmed:'confirmed',isMe:false},
     {id:3,ar:'محمد',en:'Mohammed',init:'MZ',turn:5,paid:true,confirmed:'confirmed',isMe:false},
     {id:4,ar:'فاطمة',en:'Fatima',init:'FQ',turn:6,paid:true,confirmed:'confirmed',isMe:false},
     {id:5,ar:'خالد',en:'Khalid',init:'KD',turn:4,paid:false,confirmed:'confirmed',isMe:false},
     {id:6,ar:'نورة',en:'Noura',init:'NH',turn:8,paid:true,confirmed:'confirmed',isMe:false},
     {id:7,ar:'وئام',en:'Abdullah',init:'AS',turn:7,paid:false,confirmed:'confirmed',isMe:true},
     {id:8,ar:'لينا',en:'Lina',init:'LM',turn:2,paid:false,confirmed:'confirmed',isMe:false}
  ]},
  {id:2,ar:'جمعية العائلة',en:'Family Circle',
   myRole:'organizer',amount:1000,currentTurn:0,totalTurns:5,myTurn:4,
   myTurnAr:'—',myTurnEn:'—',daysLeft:0,
   startDate:'2025-09-01',status:'waiting',
   members:[
     {id:1,ar:'سلمى',en:'Salma',init:'SL',turn:1,paid:false,confirmed:'confirmed',isMe:false},
     {id:2,ar:'فيصل',en:'Faisal',init:'FS',turn:2,paid:false,confirmed:'confirmed',isMe:false},
     {id:3,ar:'منى',en:'Mona',init:'MN',turn:3,paid:false,confirmed:'pending',isMe:false},
     {id:4,ar:'وئام',en:'Abdullah',init:'AS',turn:4,paid:false,confirmed:'confirmed',isMe:true},
     {id:5,ar:'ريم',en:'Reem',init:'RM',turn:5,paid:false,confirmed:'pending',isMe:false}
  ]},
  {id:3,ar:'جمعية الحي',en:'Neighborhood Circle',
   myRole:'member',amount:300,currentTurn:0,totalTurns:6,myTurn:2,
   myTurnAr:'—',myTurnEn:'—',daysLeft:0,
   startDate:'2025-10-01',status:'waiting',
   members:[
     {id:1,ar:'سعيد',en:'Saeed',init:'SD',turn:1,paid:false,confirmed:'confirmed',isMe:false},
     {id:2,ar:'وئام',en:'Abdullah',init:'AS',turn:2,paid:false,confirmed:'pending',isMe:true},
     {id:3,ar:'منيرة',en:'Muneera',init:'MR',turn:3,paid:false,confirmed:'confirmed',isMe:false},
     {id:4,ar:'يوسف',en:'Yousef',init:'YS',turn:4,paid:false,confirmed:'confirmed',isMe:false},
     {id:5,ar:'هند',en:'Hind',init:'HD',turn:5,paid:false,confirmed:'confirmed',isMe:false},
     {id:6,ar:'ماجد',en:'Majed',init:'MJ',turn:6,paid:false,confirmed:'pending',isMe:false}
  ]}
];

function todayISO(){var d=new Date();var y=d.getFullYear(),m=d.getMonth()+1,day=d.getDate();return y+'-'+(m<10?'0':'')+m+'-'+(day<10?'0':'')+day;}

// A circle whose payment for the logged-in member is due today — lets you try the Pay Now flow immediately.
function buildTodayCircle(){
  var moArFull=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
  var moEnFull=['January','February','March','April','May','June','July','August','September','October','November','December'];
  var start=todayISO();
  var myTurnDate=addMonths(start,2);
  return {id:4,ar:'جمعية اليوم',en:'Today Circle',
    myRole:'member',amount:400,currentTurn:1,totalTurns:4,myTurn:3,
    myTurnAr:moArFull[myTurnDate.getMonth()],myTurnEn:moEnFull[myTurnDate.getMonth()],
    daysLeft:0,
    startDate:start,status:'active',
    members:[
      {id:1,ar:'نايف',en:'Nayef',init:'NF',turn:1,paid:false,confirmed:'confirmed',isMe:false},
      {id:2,ar:'شهد',en:'Shahad',init:'SH',turn:2,paid:false,confirmed:'confirmed',isMe:false},
      {id:3,ar:'وئام',en:'Abdullah',init:'AS',turn:3,paid:false,confirmed:'confirmed',isMe:true},
      {id:4,ar:'بدر',en:'Badr',init:'BD',turn:4,paid:false,confirmed:'confirmed',isMe:false}
    ]};
}

var DB_VERSION='5';
function dbInit(){
  if(localStorage.getItem('waj_seed_version')!==DB_VERSION){
    localStorage.setItem(DB_KEY,JSON.stringify(SEED.concat([buildTodayCircle()])));
    localStorage.setItem('waj_seed_version',DB_VERSION);
  }
  var s=null;try{s=JSON.parse(localStorage.getItem(DB_SET));}catch(e){}
  if(s){state.settings=s;state.lang=s.lang;}
}
function getCircles(){try{return JSON.parse(localStorage.getItem(DB_KEY))||[];}catch(e){return[];}}
function getCircle(id){var l=getCircles();for(var i=0;i<l.length;i++){if(l[i].id===id)return l[i];}return null;}
function updateCircle(id,updates){
  var list=getCircles();
  for(var i=0;i<list.length;i++){
    if(list[i].id===id){for(var k in updates) list[i][k]=updates[k]; break;}
  }
  localStorage.setItem(DB_KEY,JSON.stringify(list));
}
function saveCircle(c){
  var list=getCircles();
  c.id=Date.now();c.currentTurn=0;c.daysLeft=0;c.status='waiting';
  c.myTurn=c.members.length;c.myTurnAr='—';c.myTurnEn='—';
  list.push(c);
  localStorage.setItem(DB_KEY,JSON.stringify(list));
}
function saveSettings(s){localStorage.setItem(DB_SET,JSON.stringify(s));}
function myMember(c){for(var i=0;i<c.members.length;i++){if(c.members[i].isMe)return c.members[i];}return null;}
function isInvitation(c){var me=myMember(c);return c.myRole==='member'&&me&&me.confirmed==='pending';}

var DB_NOTIF='waj_notifications';
function getNotifications(){try{return JSON.parse(localStorage.getItem(DB_NOTIF))||[];}catch(e){return[];}}
function addNotification(ar,en){
  var list=getNotifications();
  list.unshift({id:Date.now(),ar:ar,en:en,date:new Date().toISOString(),read:false});
  localStorage.setItem(DB_NOTIF,JSON.stringify(list));
}
function markNotificationsRead(){
  var list=getNotifications();
  list.forEach(function(n){n.read=true});
  localStorage.setItem(DB_NOTIF,JSON.stringify(list));
}

// ═══════════════════════════════════════════════════════════
// 5. HELPERS
// ═══════════════════════════════════════════════════════════
var $app=document.getElementById('app'),$nav=document.getElementById('nav');
function isA(){return state.lang==='ar'}
function tt(){return T[state.lang]}
function ta(){return isA()?'right':'left'}
function el(id){return document.getElementById(id)}
function on(id,evt,fn){var e=el(id);if(e)e.addEventListener(evt,fn)}
function qa(sel){return document.querySelectorAll(sel)}
function applyScale(){document.documentElement.style.setProperty('--sc',({normal:1,large:1.2,xlarge:1.45})[state.settings.textSize]||1)}
function logoHtml(){return '<div class="logo"><img src="Logo-Jamiyahtech.png" class="logo-ic" alt="JameyaTech" /><p class="txl b9" style="color:var(--primary-dark)">جمعيتك</p><p class="ts cm" style="margin-top:3px">JameyaTech</p></div>';}
function fmtDateObj(d){var mo=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];var moAr=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];return isA()?(d.getDate()+' '+moAr[d.getMonth()]+' '+d.getFullYear()):(mo[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear());}
function fmtDate(iso){if(!iso)return '—';return fmtDateObj(new Date(iso+'T00:00:00'));}
function addMonths(iso,n){
  var d=new Date(iso+'T00:00:00');
  var day=d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth()+n);
  var daysInMonth=new Date(d.getFullYear(),d.getMonth()+1,0).getDate();
  d.setDate(Math.min(day,daysInMonth));
  return d;
}

// ═══════════════════════════════════════════════════════════
// 6. SCREENS
// ═══════════════════════════════════════════════════════════

// ── Language ──────────────────────────────────────────────
function scrLanguage(){
  $app.innerHTML='<div class="cen">'+logoHtml()+
    '<p class="txl b8 ct tc" style="margin-bottom:6px">اختر لغتك</p>'+
    '<p class="tb cm tc" style="margin-bottom:36px">Choose your language</p>'+
    '<div style="width:100%">'+
    '<button id="la" class="lbtn" style="flex-direction:row-reverse"><span style="font-size:28px">🇸🇦</span><div style="text-align:right"><p class="txl b9 ct">العربية</p><p class="ts cm">Arabic</p></div></button>'+
    '<button id="le" class="lbtn"><div style="text-align:left"><p class="txl b9 ct">English</p><p class="ts cm">الإنجليزية</p></div><span style="font-size:28px">🌐</span></button></div></div>';
  on('la','click',function(){setState({lang:'ar',phase:'phone',settings:Object.assign({},state.settings,{lang:'ar'})})});
  on('le','click',function(){setState({lang:'en',phase:'phone',settings:Object.assign({},state.settings,{lang:'en'})})});
}

// ── Phone ─────────────────────────────────────────────────
function scrPhone(){
  var l=tt();
  $app.innerHTML='<div class="auth">'+logoHtml()+
    '<div style="text-align:'+ta()+';margin-bottom:28px"><h2 class="t2 b9 ct" style="margin-bottom:6px">'+l.welcomeBack+'</h2><p class="tb cm">'+l.welcomeSub+'</p></div>'+
    '<div class="fg"><label class="fl">'+l.nationalIdLabel+'</label><input id="nid" type="text" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.nationalIdPH+'" maxlength="10" value="'+(state.loginNationalId||'')+'" /></div>'+
    '<div class="fg"><label class="fl">'+l.phoneLabel+'</label><div class="phr"><div class="phx"><span>🇸🇦</span><span>+966</span></div><input id="phi" type="tel" inputmode="numeric" dir="ltr" class="fi f1" placeholder="'+l.phonePH+'" maxlength="10" value="'+(state.loginPhone||'')+'" /></div></div>'+
    '<div class="fg"><label class="fl">'+l.usernameLabel+'</label><input id="uname" type="text" dir="'+(isA()?'rtl':'ltr')+'" class="fi" placeholder="'+l.usernamePH+'" value="'+(state.loginUsername||'')+'" /></div>'+
    '<p id="pe" class="ts cr" style="margin-top:-8px;margin-bottom:8px;display:none;text-align:'+ta()+'"></p>'+
    '<div style="flex:1"></div><div class="fc g12"><button id="bsc" class="bp">'+l.sendCode+'</button><p class="tx cm tc">🔐 '+l.nafath+'</p></div></div>';
  on('nid','input',function(){state.loginNationalId=el('nid').value.replace(/\D/g,'').slice(0,10)});
  on('phi','input',function(){state.loginPhone=el('phi').value.replace(/\D/g,'').slice(0,10)});
  on('uname','input',function(){state.loginUsername=el('uname').value});
  on('bsc','click',function(){
    var nid=(el('nid').value||'').replace(/\D/g,'');
    var p=(el('phi').value||'').replace(/\D/g,'');
    var u=(el('uname').value||'').trim();
    if(nid.length<10){el('pe').textContent=l.errNationalId;el('pe').style.display='block';return;}
    if(p.length<9){el('pe').textContent=l.errPhone;el('pe').style.display='block';return;}
    if(!u){el('pe').textContent=l.errUsername;el('pe').style.display='block';return;}
    state.loginNationalId=nid;state.loginPhone=p;state.loginUsername=u;setState({phase:'otp'});
  });
}

// ── OTP ───────────────────────────────────────────────────
function scrOtp(){
  var l=tt();
  $app.innerHTML='<div class="auth">'+logoHtml()+
    '<div style="text-align:'+ta()+';margin-bottom:10px"><h2 class="t2 b9 ct" style="margin-bottom:8px">'+l.enterCode+'</h2><p class="tb cm">'+l.codeSentTo+': <strong dir="ltr" style="color:var(--text)">+966 '+state.loginPhone+'</strong></p></div>'+
    '<div class="otpr"><input class="otp" id="o0" type="text" inputmode="numeric" maxlength="1" /><input class="otp" id="o1" type="text" inputmode="numeric" maxlength="1" /><input class="otp" id="o2" type="text" inputmode="numeric" maxlength="1" /><input class="otp" id="o3" type="text" inputmode="numeric" maxlength="1" /></div>'+
    '<div style="flex:1"></div><div class="fc g14 ac"><button id="bv" class="bp" disabled>'+l.verify+'</button><button id="br" class="bg-btn" style="width:auto">'+l.resend+'</button></div></div>';
  var bx=[el('o0'),el('o1'),el('o2'),el('o3')];
  function chk(){var f=bx.every(function(b){return b.value.length===1});el('bv').disabled=!f;bx.forEach(function(b){b.classList.toggle('on',b.value.length===1)})}
  bx.forEach(function(b,i){b.addEventListener('input',function(){b.value=b.value.replace(/\D/g,'').slice(0,1);if(b.value&&i<3)bx[i+1].focus();chk()});b.addEventListener('keydown',function(e){if(e.key==='Backspace'&&!b.value&&i>0)bx[i-1].focus()})});
  bx[0].focus();
  on('bv','click',function(){setState({phase:'app',tab:'circles'})});
  on('br','click',function(){bx.forEach(function(b){b.value='';b.classList.remove('on')});el('bv').disabled=true;bx[0].focus()});
}

// ── Circles list ──────────────────────────────────────────
function scrCircles(){
  var l=tt(),all=getCircles(),invites=all.filter(isInvitation),circles=all.filter(function(c){return !isInvitation(c)}),h='',ih='';

  invites.forEach(function(c){
    var nm=isA()?c.ar:c.en;
    ih+='<div class="cd cd-pu"><p class="tl b8 ct" style="margin-bottom:4px">'+nm+'</p>'+
      '<p class="ts cm" style="margin-bottom:12px">'+l.inviteDesc+'</p>'+
      '<div class="cstats" style="grid-template-columns:1fr 1fr;margin:0 0 14px"><div class="cstat"><p class="csv">'+c.amount+'</p><p class="csl">'+l.monthlyUnit+'</p></div>'+
      '<div class="cstat"><p class="csv">'+c.members.length+'</p><p class="csl">'+l.membersTitle+'</p></div></div>'+
      '<div class="f row g10"><button class="bp invite-accept" data-cid="'+c.id+'" style="flex:1">'+l.acceptBtn+'</button>'+
      '<button class="bd invite-decline" data-cid="'+c.id+'" style="flex:1">'+l.declineBtn+'</button></div></div>';
  });

  if(circles.length===0&&invites.length===0){
    h='<div class="cd" style="text-align:center;padding:40px 20px"><p style="font-size:48px;margin-bottom:14px">🏦</p><p class="tl b7 ct" style="margin-bottom:8px">'+l.noCircles+'</p><p class="tb cm">'+l.noCirclesSub+'</p></div>';
  } else {
    circles.forEach(function(c){
      var nm=isA()?c.ar:c.en,isOrg=c.myRole==='organizer';
      var conf=c.members.filter(function(m){return m.confirmed==='confirmed'}).length;
      var isWaiting=c.status==='waiting';
      var unpd=c.members.filter(function(m){return !m.paid&&m.turn<c.currentTurn}).length;
      var ok=isWaiting?false:unpd===0;
      var turnM=isA()?c.myTurnAr:c.myTurnEn;
      var statusBadge=isWaiting
        ? '<span class="bz bz-pu">'+l.statusWaiting+'</span>'
        : '<span class="bz '+(ok?'bz-gr':'bz-yl')+'">'+(ok?l.statusActive:'!')+'</span>';
      var statsHtml=isWaiting
        ? '<div class="cstats"><div class="cstat"><p class="csv">'+c.amount+'</p><p class="csl">'+l.monthlyUnit+'</p></div>'+
          '<div class="cstat"><p class="csv tb">'+l.confirmedOf(conf,c.members.length)+'</p><p class="csl">'+(isA()?'أكدوا':'Confirmed')+'</p></div>'+
          '<div class="cstat"><p class="csv" style="color:var(--gold)">'+turnM+'</p><p class="csl">'+l.myTurnIn+'</p></div></div>'
        : '<div class="cstats" style="grid-template-columns:1fr 1fr"><div class="cstat"><p class="csv">'+c.amount+'</p><p class="csl">'+l.monthlyUnit+'</p></div>'+
          '<div class="cstat"><p class="csv" style="color:var(--gold)">'+turnM+'</p><p class="csl">'+l.myTurnIn+'</p></div></div>';

      h+='<div class="cd cd-click cc" data-cid="'+c.id+'">'+
        '<div class="f row jb as" style="margin-bottom:10px"><div style="text-align:'+ta()+';flex:1">'+
        '<p class="tl b8 ct" style="margin-bottom:6px">'+nm+'</p>'+
        '<div class="f row g8" style="flex-wrap:wrap"><span class="bz '+(isOrg?'bz-go':'bz-pr')+'">'+(isOrg?l.roleOrganizer:l.roleMember)+'</span>'+statusBadge+'</div></div>'+
        '<span class="cm txl" style="margin-'+(isA()?'right':'left')+':8px">›</span></div>'+
        statsHtml+
        (isWaiting?'':'<p class="ts cm" style="text-align:'+ta()+';margin-top:8px;font-weight:600">⏱ '+l.daysLeftLabel(c.daysLeft)+'</p>')+
        '</div>';
    });
  }
  var invitesBlock=invites.length>0?'<p class="slbl" style="text-align:'+ta()+';margin-top:0">'+l.invitationsTitle+'</p>'+ih:'';
  var unread=getNotifications().filter(function(n){return !n.read}).length;
  var bellHtml='<button id="bbell" class="bell-btn">🔔'+(unread>0?'<span class="bell-dot"></span>':'')+'</button>';
  var brandHtml='<div class="f row g6 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><img src="Logo-Jamiyahtech.png" class="brand-ic" alt="" /><p class="htop" style="margin-bottom:0">جمعيتك · JameyaTech</p></div>';
  $app.innerHTML='<div class="has-nav"><div class="hdr"><div class="f row jb ac">'+brandHtml+bellHtml+'</div><h1 style="text-align:'+ta()+'">'+l.myCircles+'</h1></div><div class="body">'+invitesBlock+h+'</div></div>';
  qa('.cc').forEach(function(card){card.addEventListener('click',function(){setState({activeCircleId:parseInt(card.dataset.cid,10)})})});
  on('bbell','click',function(){setState({notifView:true})});
  qa('.invite-accept').forEach(function(btn){btn.addEventListener('click',function(){respondInvite(parseInt(btn.dataset.cid,10),true)})});
  qa('.invite-decline').forEach(function(btn){btn.addEventListener('click',function(){respondInvite(parseInt(btn.dataset.cid,10),false)})});
}

function scrNotifications(){
  var l=tt(),list=getNotifications(),h='';
  if(list.length===0){
    h='<div class="cd" style="text-align:center;padding:40px 20px"><p style="font-size:48px;margin-bottom:14px">🔔</p><p class="tb cm">'+l.noNotifications+'</p></div>';
  } else {
    list.forEach(function(n){
      h+='<div class="cd" style="text-align:'+ta()+'"><p class="tb b7 ct">'+(isA()?n.ar:n.en)+'</p>'+
        '<p class="tx cm" style="margin-top:6px">'+fmtDate(n.date.slice(0,10))+'</p></div>';
    });
  }
  markNotificationsRead();
  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbknotif">'+l.backBtn+'</button>'+
    '<h1 style="text-align:'+ta()+'">'+l.notificationsTitle+'</h1></div><div class="body">'+h+'</div></div>';
  on('bbknotif','click',function(){setState({notifView:false})});
}

function respondInvite(circleId,accept){
  if(accept){
    var c=getCircle(circleId);if(!c)return;
    var me=myMember(c);if(me)me.confirmed='confirmed';
    updateCircle(circleId,{members:c.members});
  } else {
    var list=getCircles().filter(function(x){return x.id!==circleId});
    localStorage.setItem(DB_KEY,JSON.stringify(list));
  }
  setState({});
}

// ── Circle detail ─────────────────────────────────────────
function scrDetail(){
  var l=tt(),c=getCircle(state.activeCircleId);
  if(!c){setState({activeCircleId:null});return;}

  var isOrg=c.myRole==='organizer';
  var sorted=c.members.slice().sort(function(a,b){return a.turn-b.turn});
  var curM=null; c.members.forEach(function(m){if(m.turn===c.currentTurn)curM=m});
  var conf=c.members.filter(function(m){return m.confirmed==='confirmed'}).length;
  var allConfirmed=conf===c.members.length;
  var isWaiting=c.status==='waiting';
  var unpaid=c.members.filter(function(m){return !m.paid&&m.turn<c.currentTurn});
  var ok=isWaiting?false:unpaid.length===0;
  var unpN=unpaid.map(function(m){return isA()?m.ar:m.en}).join(isA()?' و':' & ');
  var nm=isA()?c.ar:c.en;
  var turnM=isA()?c.myTurnAr:c.myTurnEn;
  var pot=c.amount*c.totalTurns;
  var meMember=myMember(c);
  var iNeedToPay=!isWaiting&&meMember&&!meMember.paid&&meMember.turn!==c.currentTurn;
  var detail='';

  if(state.payMode==='form')return scrPay(c);
  if(state.payMode==='success')return scrPaySuccess(c);

  // ── WAITING STATE ──
  if(isWaiting){
    var pct=Math.round((conf/c.members.length)*100);

    // Locked banner
    detail+='<div class="locked-overlay"><div class="locked-icon">🔒</div>'+
      '<p class="tl b8 ct" style="margin-bottom:6px">'+l.waitingTitle+'</p>'+
      '<p class="ts cm" style="margin-bottom:12px">'+l.waitingDesc+'</p>'+
      '<p class="tm b7 ct">'+l.confirmProgress+'</p>'+
      '<p class="t2 b9 cp" style="margin-top:4px">'+conf+' / '+c.members.length+'</p>'+
      '<div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%"></div></div></div>';

    // Start date
    detail+='<div class="cd"><div class="date-display"><span style="font-size:22px">📅</span>'+
      '<div style="flex:1;text-align:'+ta()+'"><p class="tx cm">'+l.startDateDisplay+'</p>'+
      '<p class="tm b7 ct">'+fmtDate(c.startDate)+'</p></div></div></div>';

    // Ready banner (if all confirmed)
    if(allConfirmed&&isOrg){
      detail+='<div class="cd cd-gr"><div class="f row g12 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
        '<span style="font-size:28px">🎉</span>'+
        '<p class="tm b7" style="color:var(--green);text-align:'+ta()+'">'+l.readyToStart+'</p></div></div>';
    }

    // Turn order (organizer can drag to reorder) + add member
    if(isOrg){
      detail+='<div class="cd"><p class="st">'+l.turnOrderTitle+'</p>'+
        '<p class="ts cm" style="margin-bottom:16px">'+l.turnOrderDesc+'</p>'+
        '<div id="sortableList">';
      sorted.forEach(function(m){
        var n=isA()?m.ar:m.en;
        detail+='<div class="mr sortable-row" data-mid="'+m.id+'" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
          '<div class="drag-handle">⠿</div>'+
          '<div class="turn-num '+(m.isMe?'turn-num-me':'turn-num-def')+'">'+m.turn+'</div>'+
          '<div class="mav" style="width:36px;height:36px;font-size:13px">'+m.init+'</div>'+
          '<div style="flex:1;text-align:'+ta()+'"><p class="tb '+(m.isMe?'b8':'b6')+' ct">'+n+(m.isMe?' <span class="cm ts">'+l.youLabel+'</span>':'')+'</p></div>'+
          '</div>';
      });
      detail+='</div>'+
        '<button id="btglAdd" class="bg-btn" style="margin-top:8px">'+l.addMemberToggle+'</button>'+
        '<div id="addMemberForm" style="display:none;margin-top:8px;direction:'+(isA()?'rtl':'ltr')+'">'+
        '<div class="fg"><label class="fl">'+l.memberNameLabel+'</label><input id="dmn" type="text" class="fi" placeholder="'+l.memberNamePH+'" /></div>'+
        '<div class="fg" style="margin-bottom:0"><label class="fl">'+l.memberPhoneLabel+'</label><input id="dmp" type="tel" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.memberPhonePH+'" maxlength="10" /></div>'+
        '<div id="dra"></div><div id="draAi" style="margin-top:10px"></div>'+
        '<button id="dbaAi" class="bg-btn" style="display:none;margin-top:4px">'+l.askRiskAgent+'</button>'+
        '<p id="de2" class="ts cr" style="margin-bottom:12px;margin-top:12px;display:none;text-align:'+ta()+'"></p>'+
        '<button id="dba" class="bo" style="margin-top:12px">'+l.addBtn+'</button></div>'+
        '</div>';

      // Start button — only once everyone has confirmed
      if(allConfirmed){
        detail+='<button id="bstart" class="bstart">'+l.startCircleBtn+'</button>';
      }

      // Manage circle — price + delete (only before the circle starts)
      detail+='<div class="cd"><p class="st">'+l.manageCircleTitle+'</p>'+
        '<div class="f row jb ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
        '<div style="text-align:'+ta()+'"><p class="tx cm">'+l.amountLabel+'</p>'+
        '<p id="priceDisplay" class="tl b8 ct" dir="ltr">'+c.amount+' '+l.sarUnit+'</p></div>'+
        '<button id="btglPrice" class="bg-btn" style="width:auto">'+l.editPriceBtn+'</button></div>'+
        '<div id="priceForm" style="display:none;margin-top:12px;direction:'+(isA()?'rtl':'ltr')+'">'+
        '<div class="fg" style="margin-bottom:8px"><label class="fl">'+l.newPriceLabel+'</label><input id="npAmount" type="text" inputmode="numeric" dir="ltr" class="fi" value="'+c.amount+'" /></div>'+
        '<p id="priceErr" class="ts cr" style="margin-bottom:8px;display:none;text-align:'+ta()+'"></p>'+
        '<div class="f row g10"><button id="bsavePrice" class="bp" style="flex:1">'+l.savePriceBtn+'</button>'+
        '<button id="bcancelPrice" class="bg-btn" style="flex:1">'+l.cancelBtn+'</button></div></div>'+
        '<p id="priceMsg" class="ts" style="color:var(--green);margin-top:10px;display:none;text-align:'+ta()+'">'+l.priceUpdatedMsg+'</p>'+
        '<div style="border-top:1px solid var(--border);margin:16px 0"></div>'+
        '<button id="btglDelete" class="bd">'+l.deleteCircleBtn+'</button>'+
        '<div id="deleteConfirm" style="display:none;margin-top:12px;text-align:'+ta()+'">'+
        '<p class="tm b8" style="color:var(--red)">'+l.deleteConfirmTitle+'</p>'+
        '<p class="ts cm" style="margin:6px 0 12px">'+l.deleteConfirmDesc+'</p>'+
        '<div class="f row g10"><button id="bconfirmDelete" class="bd" style="flex:1">'+l.confirmDeleteBtn+'</button>'+
        '<button id="bcancelDelete" class="bg-btn" style="flex:1">'+l.cancelBtn+'</button></div></div>'+
        '</div>';
    }

  // ── ACTIVE STATE ──
  } else {
    // Status banner
    detail+='<div class="cd '+(ok?'cd-gr':'cd-yl')+'"><div class="f row g14 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<div style="width:52px;height:52px;border-radius:50%;flex-shrink:0;background:'+(ok?'var(--green)':'var(--yellow)')+';display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;font-weight:900">'+(ok?'✓':'!')+'</div>'+
      '<div style="flex:1;text-align:'+ta()+'"><p class="tl b8 ct">'+(ok?l.allGood:l.hasDelay)+'</p>'+
      (!ok?'<p class="ts" style="margin-top:5px;color:var(--yellow);font-weight:600">'+l.handlingIt(unpN)+'</p>':'')+
      '</div></div>'+
      (!ok?'<button id="bmediate" class="bg-btn" style="margin-top:6px">'+l.mediateBtn+'</button><div id="mediateResult" style="margin-top:10px"></div>':'')+
      '</div>';

    // Pay due (current user)
    if(iNeedToPay){
      detail+='<div class="cd cd-yl"><div class="f row jb ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
        '<div style="text-align:'+ta()+'"><p class="tl b8" style="color:var(--yellow)">'+l.payDueTitle+'</p>'+
        '<p class="ts cm" style="margin-top:4px">'+l.payDueDesc+'</p></div>'+
        '<p class="txl b9" style="color:var(--yellow)" dir="ltr">'+c.amount+'</p></div>'+
        '<button id="bgopay" class="bstart" style="margin-top:14px">'+l.payNowBtn+'</button></div>';
    }

    // Start date
    detail+='<div class="cd"><div class="date-display"><span style="font-size:22px">📅</span>'+
      '<div style="flex:1;text-align:'+ta()+'"><p class="tx cm">'+l.startDateDisplay+'</p>'+
      '<p class="tm b7 ct">'+fmtDate(c.startDate)+'</p></div></div></div>';

    // Stats
    detail+='<div class="twoc"><div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.nextPayment+'</p><p class="t4 b9 cp">'+c.daysLeft+'</p><p class="tx cm">'+l.daysUnit+'</p></div>'+
      '<div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.myTurnLabel+'</p><p class="txl b9 cg">'+turnM+'</p><p class="tx cm">'+l.youReceive+': SAR '+pot+'</p></div></div>';

    // Current turn
    detail+='<div class="cd"><p class="st">'+l.currentTurn+' · '+l.turnOf(c.currentTurn,c.totalTurns)+'</p>'+
      '<div style="background:var(--primary-lt);border-radius:14px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<div style="text-align:'+ta()+'"><p class="tl b8 ct">'+(curM?(isA()?curM.ar:curM.en):'—')+'</p><p class="tx cm">'+l.potLabel+'</p></div>'+
      '<p class="txl b9 cp" dir="ltr">SAR '+pot+'</p></div></div>';

    // Yield Agent — potential earnings on the idle pooled amount
    detail+='<div class="cd"><p class="st">'+l.yieldCardTitle+'</p>'+
      '<p class="ts cm" style="margin-bottom:14px">'+l.yieldDesc+'</p>'+
      '<button id="byield" class="bo">'+l.yieldBtn+'</button>'+
      '<div id="yieldResult" style="margin-top:12px"></div></div>';

    // Members
    var cols='<div class="f row jb ac" style="padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:12px;'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<p class="tx cm b7" style="flex:1;text-align:'+ta()+'">'+(isA()?'الاسم':'Name')+'</p>'+
      '<p class="tx cm b7" style="min-width:60px;text-align:center">'+l.colOrder+'</p>'+
      '<p class="tx cm b7" style="min-width:80px;text-align:center">'+l.colPayment+'</p></div>';
    var rows='';
    sorted.forEach(function(m){
      var n=isA()?m.ar:m.en;
      var isRecipient=m.turn===c.currentTurn;
      var payHtml=isRecipient
        ? '<span class="bz bz-go">'+l.exemptBadge+'</span>'
        : '<span class="bz '+(m.paid?'bz-gr':'bz-yl')+'">'+(m.paid?l.paidBadge:l.notPaidBadge)+'</span>';
      rows+='<div class="mr" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
        '<div class="mav" style="width:36px;height:36px;font-size:13px">'+m.init+'</div>'+
        '<div style="flex:1;text-align:'+ta()+'"><p class="tb '+(m.isMe?'b8':'b6')+' ct">'+n+(m.isMe?' <span class="cm ts">'+l.youLabel+'</span>':'')+'</p></div>'+
        '<div style="min-width:60px;display:flex;justify-content:center"><div class="turn-num '+(m.isMe?'turn-num-me':'turn-num-def')+'">'+m.turn+'</div></div>'+
        '<div style="min-width:80px;display:flex;justify-content:center">'+payHtml+'</div></div>';
    });
    detail+='<div class="cd"><div class="f row jb ac" style="margin-bottom:14px;'+(isA()?'flex-direction:row-reverse;':'')+'"><p class="st" style="margin-bottom:0">'+l.membersTitle+'</p></div>'+cols+rows+'</div>';
  }

  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbk">'+l.backBtn+'</button>'+
    '<p class="htop" style="text-align:'+ta()+'">'+(isOrg?l.roleOrganizer:l.roleMember)+' · '+(isWaiting?l.statusWaiting:l.turnOf(c.currentTurn,c.totalTurns))+'</p>'+
    '<h1 style="text-align:'+ta()+'">'+nm+'</h1></div><div class="body">'+detail+'</div></div>';

  // Bindings
  on('bbk','click',function(){setState({activeCircleId:null,payMode:'off'})});

  // Pay now
  on('bgopay','click',function(){setState({payMode:'form'})});

  // Mediator Agent — draft a resolution for the first unpaid member
  on('bmediate','click',function(){
    el('mediateResult').innerHTML='<p class="ts cm">'+l.mediateLoading+'</p>';
    var target=unpaid[0];
    if(!target)return;
    var payload={event_type:'payment_missed',member_data:{
      name:isA()?target.ar:target.en,
      months_in_circle_before:c.currentTurn||1,
      payment_history:['on_time','missed'],
      amount_due:c.amount
    }};
    callAgent(payload,function(result,err){
      if(err){el('mediateResult').innerHTML='<p class="ts cr">'+l.agentErrorPrefix+err+'</p>';return;}
      var med=(result&&result.result)||{};
      var optsHtml='';
      (med.restructuring_options||[]).forEach(function(opt,i){
        optsHtml+='<div class="cd" style="margin-bottom:8px;padding:12px 14px"><p class="ts ct"><strong>'+(i+1)+'.</strong> '+opt+'</p></div>';
      });
      el('mediateResult').innerHTML=
        '<div class="cd cd-pu" style="margin-top:0"><p class="tm b8" style="margin-bottom:6px">'+l.mediateMsgTitle+'</p><p class="ts ct">'+(med.message_to_member||'')+'</p></div>'+
        '<p class="slbl" style="margin:14px 0 8px;text-align:'+ta()+'">'+l.restructOptionsTitle+'</p>'+optsHtml+
        '<div class="cd" style="margin-top:0"><p class="tm b8" style="margin-bottom:6px">'+l.draftContractTitle+'</p><p class="ts cm">'+(med.draft_contract_note||'')+'</p></div>';
    });
  });

  // Yield Agent
  on('byield','click',function(){
    el('yieldResult').innerHTML='<p class="ts cm">'+l.yieldLoading+'</p>';
    var payload={event_type:'calculate_yield',pooled_amount:pot,months_idle:c.currentTurn||1};
    callAgent(payload,function(result,err){
      if(err){el('yieldResult').innerHTML='<p class="ts cr">'+l.agentErrorPrefix+err+'</p>';return;}
      var y=(result&&result.result)||{};
      el('yieldResult').innerHTML=
        '<div class="twoc" style="margin-bottom:12px"><div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.yieldEarnedLabel+'</p><p class="tl b9" style="color:var(--gold)" dir="ltr">+'+y.yield_earned+'</p></div>'+
        '<div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.yieldNewTotalLabel+'</p><p class="tl b9 cp" dir="ltr">'+y.new_total+'</p></div></div>'+
        '<p class="ts ct" style="text-align:'+ta()+'">'+(y.explanation||'')+'</p>';
    });
  });

  // Drag-to-reorder turn order
  bindSortable('sortableList',c.id);

  // Add member before start
  on('btglAdd','click',function(){
    var f=el('addMemberForm');
    f.style.display=f.style.display==='none'?'block':'none';
  });
  var _detailRisk=null;
  on('dmp','input',function(){
    var p=el('dmp').value.replace(/\D/g,'').slice(0,10);el('dmp').value=p;el('de2').style.display='none';
    el('draAi').innerHTML='';
    if(p.length===10){
      _detailRisk=checkRisk(p);
      el('dbaAi').style.display='inline-block';
      if(_detailRisk){
        var r=_detailRisk,isR=r.level==='red';
        el('dra').innerHTML='<div class="rsk '+(isR?'rsk-rd':'rsk-yl')+'"><div style="font-size:22px;flex-shrink:0">'+(isR?'🚫':'⚡')+'</div><div style="flex:1"><p class="tm b8" style="margin-bottom:4px;color:'+(isR?'var(--red)':'var(--yellow)')+'">'+(isR?l.riskRedTitle:l.riskYellowTitle)+'</p><p class="ts ct" style="margin-bottom:6px"><strong>'+(isA()?r.ar:r.en)+'</strong> — '+(isA()?r.rAr:r.rEn)+'</p><p class="tx cm">'+l.riskHistory+': '+(isA()?r.hAr:r.hEn)+'</p></div></div>';
        el('dba').textContent=l.addAnywayBtn;el('dba').className=isR?'bd':'bo';
      } else {el('dra').innerHTML='';el('dba').textContent=l.addBtn;el('dba').className='bo';}
    } else {_detailRisk=null;el('dra').innerHTML='';el('dba').textContent=l.addBtn;el('dba').className='bo';el('dbaAi').style.display='none';}
  });
  on('dbaAi','click',function(){runRiskAgentCheck(el('dmn').value.trim(),_detailRisk,'draAi')});
  on('dba','click',function(){
    var n=el('dmn').value.trim(),p=el('dmp').value.trim();
    if(!n||p.length<9){el('de2').textContent=l.errFillAll;el('de2').style.display='block';return;}
    addMemberToCircle(c.id,{ar:n,en:n,phone:p,risk:_detailRisk?_detailRisk.level:null});
  });

  // Start button
  on('bstart','click',function(){
    updateCircle(c.id,{status:'active',currentTurn:1,daysLeft:30});
    setState({});
  });

  // Edit price
  on('btglPrice','click',function(){
    var f=el('priceForm');
    f.style.display=f.style.display==='none'?'block':'none';
    el('priceMsg').style.display='none';
  });
  on('bcancelPrice','click',function(){el('priceForm').style.display='none'});
  on('bsavePrice','click',function(){
    var newAmount=parseInt(el('npAmount').value.replace(/\D/g,''),10);
    if(!newAmount||newAmount<=0){el('priceErr').textContent=l.errPrice;el('priceErr').style.display='block';return;}
    var oldAmount=c.amount;
    updateCircle(c.id,{amount:newAmount});
    addNotification(T.ar.priceChangeNotif(c.ar,oldAmount,newAmount),T.en.priceChangeNotif(c.en,oldAmount,newAmount));
    el('priceForm').style.display='none';
    el('priceDisplay').textContent=newAmount+' '+l.sarUnit;
    el('priceMsg').style.display='block';
    c.amount=newAmount;
  });

  // Delete circle (waiting only)
  on('btglDelete','click',function(){
    var d=el('deleteConfirm');
    d.style.display=d.style.display==='none'?'block':'none';
  });
  on('bcancelDelete','click',function(){el('deleteConfirm').style.display='none'});
  on('bconfirmDelete','click',function(){
    var list=getCircles().filter(function(x){return x.id!==c.id});
    localStorage.setItem(DB_KEY,JSON.stringify(list));
    addNotification(T.ar.circleDeletedNotif(c.ar),T.en.circleDeletedNotif(c.en));
    setState({activeCircleId:null});
  });
}

// ── Pay screen ────────────────────────────────────────────
var _payMethod='mada';
function scrPay(c){
  var l=tt(),nm=isA()?c.ar:c.en;
  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbkpay">'+l.backBtn+'</button>'+
    '<p class="htop" style="text-align:'+ta()+'">'+nm+'</p>'+
    '<h1 style="text-align:'+ta()+'">'+l.payScreenTitle+'</h1></div><div class="body">'+
    '<div class="cd" style="text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.amountDueLabel+'</p>'+
    '<p class="t3 b9 cp" dir="ltr">'+c.amount+' '+l.sarUnit+'</p></div>'+
    '<div class="cd"><p class="st">'+l.paymentMethodLabel+'</p>'+
    '<div class="ltg"><button id="pmMada" class="ltb'+(_payMethod==='mada'?' on':'')+'">'+l.methodMada+'</button>'+
    '<button id="pmApple" class="ltb'+(_payMethod==='apple'?' on':'')+'">'+l.methodApplePay+'</button></div></div>'+
    '<button id="bconfirmPay" class="bstart">'+l.confirmPayBtn+' · '+c.amount+' '+l.sarUnit+'</button>'+
    '</div></div>';

  on('bbkpay','click',function(){setState({payMode:'off'})});
  on('pmMada','click',function(){_payMethod='mada';setState({})});
  on('pmApple','click',function(){_payMethod='apple';setState({})});
  on('bconfirmPay','click',function(){payNow(c.id);setState({payMode:'success'})});
}

function scrPaySuccess(c){
  var l=tt();
  $app.innerHTML='<div class="cen"><div class="suc">✓</div>'+
    '<h2 class="t2 b9 ct tc" style="margin-bottom:10px">'+l.paySuccessTitle+'</h2>'+
    '<p class="tb cm tc" style="margin-bottom:40px">'+l.paySuccessSub+'</p>'+
    '<button id="bbackcircle" class="bp">'+l.backToCircle+'</button></div>';
  on('bbackcircle','click',function(){setState({payMode:'off'})});
}

function payNow(circleId){
  var c=getCircle(circleId);if(!c)return;
  var me=myMember(c);if(me)me.paid=true;
  updateCircle(circleId,{members:c.members});
}

function bindSortable(containerId,circleId){
  var container=el(containerId);
  if(!container)return;
  qa('#'+containerId+' .sortable-row').forEach(function(row){
    var handle=row.querySelector('.drag-handle');
    if(!handle)return;
    handle.addEventListener('pointerdown',function(e){
      e.preventDefault();
      var dragEl=row;
      dragEl.classList.add('dragging');
      try{dragEl.setPointerCapture(e.pointerId);}catch(err){}
      function onMove(ev){
        var y=ev.clientY;
        var siblings=Array.prototype.slice.call(container.querySelectorAll('.sortable-row:not(.dragging)'));
        var next=null;
        for(var i=0;i<siblings.length;i++){
          var rect=siblings[i].getBoundingClientRect();
          if(y<rect.top+rect.height/2){next=siblings[i];break;}
        }
        if(next)container.insertBefore(dragEl,next);
        else container.appendChild(dragEl);
      }
      function onUp(ev){
        dragEl.classList.remove('dragging');
        try{dragEl.releasePointerCapture(ev.pointerId);}catch(err){}
        document.removeEventListener('pointermove',onMove);
        document.removeEventListener('pointerup',onUp);
        var order=Array.prototype.map.call(container.querySelectorAll('.sortable-row'),function(r){return parseInt(r.dataset.mid,10)});
        reorderMembers(circleId,order);
      }
      document.addEventListener('pointermove',onMove);
      document.addEventListener('pointerup',onUp);
    });
  });
}

function reorderMembers(circleId,orderedIds){
  var c=getCircle(circleId);if(!c)return;
  orderedIds.forEach(function(mid,idx){
    for(var i=0;i<c.members.length;i++){
      if(c.members[i].id===mid){c.members[i].turn=idx+1;break;}
    }
  });
  updateCircle(circleId,{members:c.members});
  setState({});
}

function addMemberToCircle(circleId,member){
  var c=getCircle(circleId);if(!c)return;
  member.id=Date.now();
  member.turn=c.members.length+1;
  member.init=member.ar.slice(0,2).toUpperCase();
  member.paid=false;
  member.confirmed='pending';
  member.isMe=false;
  c.members.push(member);
  updateCircle(circleId,{members:c.members,totalTurns:c.members.length});
  setState({});
}

// ── Create circle ─────────────────────────────────────────
var _cn='',_ca='',_cd='',_cm=[],_cr=null;

function scrCreate1(){
  var l=tt();
  // Default date to next month
  if(!_cd){var d=new Date();d.setMonth(d.getMonth()+1);_cd=d.toISOString().split('T')[0];}

  $app.innerHTML='<div class="has-nav"><div class="hdr"><h1 style="text-align:'+ta()+'">'+l.createTitle+'</h1>'+
    '<p class="hsub" style="text-align:'+ta()+'">'+l.step1Label+'</p></div>'+
    '<div class="sbar"><div class="si dn"></div><div class="si"></div></div>'+
    '<div class="body"><div class="cd"><div style="direction:'+(isA()?'rtl':'ltr')+'">'+
    '<div class="fg"><label class="fl">'+l.circleNameLabel+'</label><input id="cn" type="text" class="fi" placeholder="'+l.circleNamePH+'" value="'+_cn+'" /></div>'+
    '<div class="fg"><label class="fl">'+l.amountLabel+'</label><input id="ca" type="text" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.amountPH+'" value="'+_ca+'" /></div>'+
    '<div class="fg"><label class="fl">'+l.startDateLabel+'</label><input id="cdate" type="date" class="fi" dir="ltr" value="'+_cd+'" /></div>'+
    '</div><p id="e1" class="ts cr" style="margin-bottom:12px;display:none;text-align:'+ta()+'"></p>'+
    '<button id="bn" class="bp">'+l.nextBtn+'</button></div></div></div>';

  on('cn','input',function(){_cn=el('cn').value});
  on('ca','input',function(){_ca=el('ca').value.replace(/\D/g,'');el('ca').value=_ca});
  on('cdate','input',function(){_cd=el('cdate').value});
  on('bn','click',function(){
    if(!_cn.trim()||!_ca.trim()||!_cd){el('e1').textContent=l.errFillAll;el('e1').style.display='block';return;}
    setState({createStep:2});
  });
}

function scrCreate2(){
  var l=tt(),ml='';
  if(_cm.length===0){ml='<p class="tb cm tc" style="padding:8px 0">'+l.noMembersYet+'</p>';}
  else{_cm.forEach(function(m,i){
    var rb='';if(m.risk)rb='<span class="bz '+(m.risk==='red'?'bz-rd':'bz-yl')+'">'+(m.risk==='red'?'🔴':'⚡')+'</span>';
    ml+='<div class="mr" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="mav" style="width:40px;height:40px;font-size:15px">'+m.name.charAt(0).toUpperCase()+'</div><div style="flex:1;text-align:'+ta()+'"><p class="tb b7 ct">'+m.name+'</p><p class="ts cm" dir="ltr" style="text-align:'+ta()+'">'+m.phone+'</p></div>'+rb+'<button class="brm rmb" data-i="'+i+'">'+l.removeBtn+'</button></div>';
  });}

  $app.innerHTML='<div class="has-nav"><div class="hdr"><h1 style="text-align:'+ta()+'">'+(_cn||l.createTitle)+'</h1>'+
    '<p class="hsub" style="text-align:'+ta()+'">'+l.step2Label+'</p></div>'+
    '<div class="sbar"><div class="si dn"></div><div class="si dn"></div></div>'+
    '<div class="body">'+
    '<div class="cd"><p class="st">'+l.addMemberTitle+'</p><div style="direction:'+(isA()?'rtl':'ltr')+'">'+
    '<div class="fg"><label class="fl">'+l.memberNameLabel+'</label><input id="mn" type="text" class="fi" placeholder="'+l.memberNamePH+'" /></div>'+
    '<div class="fg" style="margin-bottom:0"><label class="fl">'+l.memberPhoneLabel+'</label><input id="mp" type="tel" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.memberPhonePH+'" maxlength="10" /></div></div>'+
    '<div id="ra"></div><div id="raAi" style="margin-top:10px"></div>'+
    '<button id="baAi" class="bg-btn" style="display:none;margin-top:4px">'+l.askRiskAgent+'</button>'+
    '<p id="e2" class="ts cr" style="margin-bottom:12px;display:none;text-align:'+ta()+'"></p>'+
    '<button id="ba" class="bo">'+l.addBtn+'</button></div>'+
    '<div class="cd"><div class="f row jb ac" style="margin-bottom:14px;'+(isA()?'flex-direction:row-reverse;':'')+'"><p class="st" style="margin-bottom:0">'+l.addedTitle+'</p><span class="bz bz-pr">'+_cm.length+'</span></div><div id="ml">'+ml+'</div></div>'+
    '<p id="ec" class="ts cr" style="margin-bottom:12px;display:none;text-align:'+ta()+'"></p>'+
    '<button id="bc" class="bp" style="margin-bottom:12px">'+l.createBtn+'</button>'+
    '<button id="bbs" class="bg-btn">'+l.backStepBtn+'</button></div></div>';

  // Risk check
  on('mp','input',function(){
    var p=el('mp').value.replace(/\D/g,'').slice(0,10);el('mp').value=p;el('e2').style.display='none';
    el('raAi').innerHTML='';
    if(p.length===10){
      _cr=checkRisk(p);
      el('baAi').style.display='inline-block';
      if(_cr){
        var r=_cr,isR=r.level==='red';
        el('ra').innerHTML='<div class="rsk '+(isR?'rsk-rd':'rsk-yl')+'"><div style="font-size:22px;flex-shrink:0">'+(isR?'🚫':'⚡')+'</div><div style="flex:1"><p class="tm b8" style="margin-bottom:4px;color:'+(isR?'var(--red)':'var(--yellow)')+'">'+(isR?l.riskRedTitle:l.riskYellowTitle)+'</p><p class="ts ct" style="margin-bottom:6px"><strong>'+(isA()?r.ar:r.en)+'</strong> — '+(isA()?r.rAr:r.rEn)+'</p><p class="tx cm">'+l.riskHistory+': '+(isA()?r.hAr:r.hEn)+'</p></div></div>';
        el('ba').textContent=l.addAnywayBtn;el('ba').className=isR?'bd':'bo';
      } else {el('ra').innerHTML='';el('ba').textContent=l.addBtn;el('ba').className='bo';}
    } else {_cr=null;el('ra').innerHTML='';el('ba').textContent=l.addBtn;el('ba').className='bo';el('baAi').style.display='none';}
  });
  on('baAi','click',function(){runRiskAgentCheck(el('mn').value.trim(),_cr,'raAi')});
  on('ba','click',function(){
    var n=el('mn').value.trim(),p=el('mp').value.trim();
    if(!n||p.length<9){el('e2').textContent=l.errFillAll;el('e2').style.display='block';return;}
    _cm.push({name:n,phone:p,risk:_cr?_cr.level:null});_cr=null;setState({createStep:2});
  });
  el('ml').addEventListener('click',function(e){var btn=e.target.closest('.rmb');if(!btn)return;_cm.splice(parseInt(btn.dataset.i,10),1);setState({createStep:2})});
  on('bc','click',function(){
    if(_cm.length<2){el('ec').textContent=l.errMinMembers;el('ec').style.display='block';return;}
    var members=_cm.map(function(m,i){return{id:i+1,ar:m.name,en:m.name,init:m.name.slice(0,2).toUpperCase(),turn:i+1,paid:false,confirmed:'pending',isMe:false}});
    saveCircle({ar:_cn,en:_cn,myRole:'organizer',amount:parseInt(_ca,10),totalTurns:_cm.length,members:members,startDate:_cd});
    _cm=[];_cn='';_ca='';_cd='';_cr=null;scrSuccess();
  });
  on('bbs','click',function(){setState({createStep:1})});
}

function scrSuccess(){
  var l=tt();
  $app.innerHTML='<div class="cen"><div class="suc">✓</div><h2 class="t2 b9 ct tc" style="margin-bottom:10px">'+l.successTitle+'</h2><p class="tb cm tc" style="margin-bottom:40px">'+l.successSub+'</p><button id="bgh" class="bp">'+l.goHome+'</button></div>';
  on('bgh','click',function(){setState({tab:'circles',activeCircleId:null,createStep:1})});
}

// ── Settings ──────────────────────────────────────────────
function scrSettings(){
  var l=tt(),s=state.settings;
  var sids=['normal','large','xlarge'],slbls=[l.sizeNormal,l.sizeLarge,l.sizeXlarge],sfn=[16,21,26];
  var szb='';sids.forEach(function(id,i){szb+='<button class="szb'+(s.textSize===id?' on':'')+'" data-sz="'+id+'"><span style="font-size:'+sfn[i]+'px;font-weight:900;line-height:1">'+(isA()?'أ':'A')+'</span><span style="font-size:10px;font-weight:700">'+slbls[i]+'</span></button>'});

  $app.innerHTML='<div class="has-nav"><div class="hdr"><h1 style="text-align:'+ta()+'">'+l.settingsTitle+'</h1></div><div class="body">'+
    '<p class="slbl" style="text-align:'+ta()+'">'+l.appearanceSection+'</p>'+
    '<div class="cd"><div style="padding-bottom:18px;border-bottom:1px solid var(--border);margin-bottom:18px"><p class="fl">'+l.languageLabel+'</p><div class="ltg"><button id="sla" class="ltb'+(s.lang==='ar'?' on':'')+'">العربية</button><button id="sle" class="ltb'+(s.lang==='en'?' on':'')+'">English</button></div></div>'+
    '<div><p class="fl">'+l.textSizeLabel+'</p><div class="szopt">'+szb+'</div><div class="spv"><p class="cp b6" style="font-size:calc(16px*var(--sc))">'+l.sizePreview+'</p><p class="cm" style="font-size:calc(14px*var(--sc));margin-top:4px">'+(isA()?'١٢٣٤ ريال سعودي':'SAR 1,234')+'</p></div></div></div>'+
    '<p class="slbl" style="text-align:'+ta()+'">'+l.notifSection+'</p>'+
    '<div class="cd"><div class="srow"><p class="tm b6 ct">💰  '+l.notifPayment+'</p><button class="tgl'+(s.notifPayment?' on':'')+'" id="tp"></button></div>'+
    '<div class="srow"><p class="tm b6 ct">👥  '+l.notifGroup+'</p><button class="tgl'+(s.notifGroup?' on':'')+'" id="tg"></button></div></div>'+
    '<p class="slbl" style="text-align:'+ta()+'">'+l.profileSection+'</p>'+
    '<div class="cd"><div class="srow"><p class="tm b6 ct">👤  '+l.nameLabel+'</p><p class="tb cm b6">'+l.nameVal+'</p></div>'+
    '<div class="srow"><p class="tm b6 ct">📱  '+l.phoneLabel2+'</p><p class="tb cm b6" dir="ltr">'+(state.loginPhone||'0512345678')+'</p></div>'+
    '<div class="srow"><p class="tm b6 ct">ℹ️  '+l.versionLabel+'</p><p class="tb cm">1.0.0</p></div></div>'+
    '<button id="blo" class="bd" style="margin-top:4px">'+l.logoutBtn+'</button></div></div>';

  on('sla','click',function(){applySet(Object.assign({},state.settings,{lang:'ar'}))});
  on('sle','click',function(){applySet(Object.assign({},state.settings,{lang:'en'}))});
  qa('.szb').forEach(function(btn){btn.addEventListener('click',function(){applySet(Object.assign({},state.settings,{textSize:btn.dataset.sz}))})});
  on('tp','click',function(){applySet(Object.assign({},state.settings,{notifPayment:!state.settings.notifPayment}))});
  on('tg','click',function(){applySet(Object.assign({},state.settings,{notifGroup:!state.settings.notifGroup}))});
  on('blo','click',function(){setState({phase:'language',tab:'circles',activeCircleId:null})});
}
function applySet(s){saveSettings(s);setState({settings:s})}

// ═══════════════════════════════════════════════════════════
// 7. NAV
// ═══════════════════════════════════════════════════════════
function renderNav(){
  if(state.phase!=='app'){$nav.className='';return;}
  $nav.className='show';
  var l=tt(),tabs=[{id:'circles',icon:'🏠',label:l.navCircles},{id:'create',icon:'➕',label:l.navCreate},{id:'settings',icon:'⚙️',label:l.navSettings}];
  var h='';tabs.forEach(function(tb){h+='<button class="ni'+(state.tab===tb.id?' on':'')+'" data-t="'+tb.id+'"><span class="ni-i">'+tb.icon+'</span><span class="ni-l">'+tb.label+'</span><span class="ni-d"></span></button>'});
  $nav.innerHTML=h;
  qa('.ni').forEach(function(btn){btn.addEventListener('click',function(){setState({tab:btn.dataset.t,activeCircleId:null,createStep:1,notifView:false,payMode:'off'})})});
}

// ═══════════════════════════════════════════════════════════
// 8. ROUTER
// ═══════════════════════════════════════════════════════════
function render(){
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==='ar'?'rtl':'ltr';
  applyScale();
  if(state.phase==='language')scrLanguage();
  else if(state.phase==='phone')scrPhone();
  else if(state.phase==='otp')scrOtp();
  else if(state.phase==='app'){
    if(state.tab==='circles'){if(state.notifView)scrNotifications();else if(state.activeCircleId!==null)scrDetail();else scrCircles();}
    else if(state.tab==='create'){if(state.createStep===2)scrCreate2();else scrCreate1();}
    else if(state.tab==='settings')scrSettings();
  }
  renderNav();
}

// ═══════════════════════════════════════════════════════════
// 9. BOOT
// ═══════════════════════════════════════════════════════════
dbInit();render();
})();
