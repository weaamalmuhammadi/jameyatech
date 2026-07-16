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
  activeCircleId:null, payMode:'off', contractView:'off', notifView:false, loginPhone:'', loginPassword:'', createStep:1,
  signupName:'', signupNid:'', signupPhone:'',
  session:null, // {phone, name_ar, name_en} once logged in -- see accounts.py
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
// Shared with any caller that needs to tell "server unreachable" apart from
// a real error the server returned (e.g. login: wrong password vs. the
// backend not being up at all look identical from a raw err string
// otherwise). Kept as a pure function of the current language so a caller
// can compare its own err against a fresh call and get the same string.
function agentUnreachableMsg(){
  return isA()
    ?'تعذر الاتصال بخدمة الوكلاء الذكية. تأكد من تشغيل agent_server.py على المنفذ 5001.'
    :'Could not reach the AI agent service. Make sure agent_server.py is running on port 5001.';
}
function callAgent(payload,onDone,path){
  fetch(AGENT_API+(path||'/api/event'),{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  }).then(function(r){
    return r.json().then(function(data){return {ok:r.ok,data:data};});
  }).then(function(res){
    if(!res.ok||res.data.error) onDone(null,res.data.error||'Request failed');
    else onDone(res.data,null);
  }).catch(function(){
    onDone(null,agentUnreachableMsg());
  });
}

// Shared Risk Agent hook used by both the Create-Circle member form and the
// "Add Member Before Start" form on the circle detail screen.
function runRiskAgentCheck(name,phone,seedRisk,targetElId,circleId){
  var l=tt();
  el(targetElId).innerHTML=skeletonHtml(2);
  var payload={event_type:'new_member',member_data:{
    name:name||'Member',
    phone:phone||'',
    monthly_income:seedRisk?(seedRisk.level==='red'?3000:6000):8000,
    payment_history:seedRisk?(seedRisk.level==='red'?['missed','missed','late_10_days']:['on_time','late_5_days','on_time']):['on_time','on_time','on_time','on_time'],
    months_in_circle_before:seedRisk?1:6
  }};
  callAgent(payload,function(result,err){
    if(err){console.error('Risk Agent error:',err);setHtml(targetElId,aiCardShell('risk','<p class="ts cr" style="display:flex;align-items:center;gap:6px">'+icon('alert',15)+' '+l.aiServiceDown+'</p>',false));return;}
    var risk=(result&&result.result)||{};
    var lvl=risk.risk_level,isR=lvl==='red',isY=lvl==='yellow',cls=isR?'rd':(isY?'yl':'gr');
    var verdictTxt=isR?l.riskRedTitle:(isY?l.riskYellowTitle:l.riskGreenTitle);
    var inner='<div class="ai-verdict '+cls+'">'+verdictTxt+'</div><p class="ts ct">'+(risk.reason||'')+'</p>';
    if(risk.name_mismatch){
      inner+='<p class="ts cr" style="display:flex;align-items:center;gap:6px;margin-top:8px">'+icon('alert',14)+' '+l.phoneNameMismatch(risk.record_name||'')+'</p>';
    }
    if(!setHtml(targetElId,aiCardShell('risk',inner,true)))return;
    bindReviewLinks();
    if(circleId)addActivity(circleId,'risk',T.ar.actRiskAssessed(name||'—'),T.en.actRiskAssessed(name||'—'));
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
  namePH:'مثال: محمد العتيبي',
  errNationalId:'يرجى إدخال رقم هوية/إقامة صحيح',
  sendCode:'إرسال رمز التحقق',enterCode:'أدخل رمز التحقق',
  codeSentTo:'تم إرسال الرمز إلى',verify:'تحقق',resend:'إعادة إرسال',
  nafath:'مدعوم بـ نفاذ',errPhone:'يرجى إدخال رقم صحيح',
  passwordLabel:'كلمة المرور',passwordPH:'••••••••',
  errPassword:'يرجى إدخال كلمة المرور',
  errPasswordFormat:'يجب أن تتكون كلمة المرور من ٨ أحرف على الأقل',
  passwordHint:'٨ أحرف على الأقل (أرقام أو حروف)',
  loginBtn:'تسجيل الدخول',loggingIn:'جاري تسجيل الدخول...',
  loginError:'رقم الجوال أو كلمة المرور غير صحيحة',
  noAccountLink:'ليس لديك حساب؟ إنشاء حساب',haveAccountLink:'لديك حساب؟ تسجيل الدخول',
  signupTitle:'إنشاء حساب جديد',signupSub:'أدخل بياناتك للانضمام إلى جمعيتك',
  createAccountBtn:'إنشاء الحساب',
  phoneTakenError:'رقم الجوال مسجّل مسبقاً، جرّب تسجيل الدخول',
  signupError:'تعذّر إنشاء الحساب، حاول مرة أخرى',
  navCircles:'جمعياتي',navCreate:'إنشاء',navSettings:'الإعدادات',
  myCircles:'جمعياتي',noCircles:'ليس لديك جمعيات بعد',
  noCirclesSub:'اضغط على + لإنشاء جمعيتك الأولى',
  roleOrganizer:'منظّم',roleMember:'عضو',
  statusActive:'نشطة',statusWaiting:'بانتظار التأكيد',
  monthlyUnit:'ريال/شهر',myTurnIn:'دوري في',
  daysLeftLabel:function(n){return n+' يوم للدفع'},
  confirmedOf:function(n,t){return n+'/'+t},
  backBtn:'الجمعيات',nextPayment:'الدفع القادم',daysUnit:'يوم',
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
  riskRedTitle:'تحذير — عضو عالي المخاطر',
  riskYellowTitle:'تنبيه — يُنصح بالحذر',
  riskGreenTitle:'مخاطر منخفضة — موثوق',
  phoneNameMismatch:function(recordName){return 'رقم الجوال مسجّل باسم مختلف'+(recordName?' ('+recordName+')':'')+' — يُنصح بالتحقق من الهوية.'},
  riskReason:'السبب',riskHistory:'السجل',
  settingsTitle:'الإعدادات',appearanceSection:'المظهر',
  languageLabel:'اللغة',textSizeLabel:'حجم الخط',
  sizeNormal:'عادي',sizeLarge:'كبير',sizeXlarge:'كبير جداً',
  sizePreview:'هذا مثال على حجم الخط',
  notifSection:'الإشعارات',notifPayment:'تذكير الدفع',
  notifGroup:'تحديثات المجموعة',profileSection:'الملف الشخصي',
  nameLabel:'الاسم',phoneLabel2:'رقم الجوال',versionLabel:'الإصدار',
  logoutBtn:'تسجيل الخروج',nameVal:'وئام',
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
  priceUpdatedMsg:'تم تحديث السعر وإشعار جميع الأعضاء',
  deleteCircleBtn:'حذف الجمعية',
  deleteConfirmTitle:'هل أنت متأكد؟',
  deleteConfirmDesc:'سيتم حذف هذه الجمعية نهائياً ولا يمكن التراجع عن هذا الإجراء.',
  confirmDeleteBtn:'نعم، احذف الجمعية',
  priceChangeNotif:function(nm,oldA,newA){return 'تم تغيير سعر جمعية «'+nm+'» من '+oldA+' إلى '+newA+' ريال شهرياً.'},
  circleDeletedNotif:function(nm){return 'تم حذف جمعية «'+nm+'».'},
  notificationsTitle:'الإشعارات',noNotifications:'لا توجد إشعارات بعد',
  askRiskAgent:'اسأل وكيل المخاطر الذكي',
  riskAgentLoading:'جاري تحليل البيانات عبر الوكيل الذكي (Groq)...',
  riskAgentTitle:'تقييم الوكيل الذكي',
  mediateBtn:'توسّط الوكيل الذكي',
  mediateLoading:'جاري صياغة الحل عبر الوكيل الذكي...',
  mediateMsgTitle:'رسالة الوكيل للعضو',
  restructOptionsTitle:'خيارات إعادة الجدولة',
  draftContractTitle:'مسودة الاتفاق',
  yieldCardTitle:'العائد على المبلغ المجمّع',
  yieldDesc:'احسب العائد المتوقع لاستثمار المبلغ الخامل عبر صندوق سوق نقدي متوافق مع الشريعة (الوكيل الذكي).',
  yieldBtn:'احسب العائد',
  yieldLoading:'جاري حساب العائد عبر الوكيل الذكي...',
  yieldEarnedLabel:'العائد المكتسب',yieldNewTotalLabel:'الإجمالي الجديد',
  agentErrorPrefix:'⚠️ ',
  valueProp1:'فحص مخاطر الأعضاء بالذكاء الاصطناعي',valueProp2:'ترتيب دور عادل تلقائياً',valueProp3:'عائد شرعي على المبلغ المجمّع',
  nafathExplain:'نتحقق من هويتك عبر نفاذ لحماية جميع أعضاء الجمعية من الاحتيال.',
  privacyNote:'بياناتك تُستخدم فقط لأغراض التحقق من الهوية.',
  otpPrivacy:'لن نطلب منك مشاركة هذا الرمز مع أي شخص، حتى لو ادّعى أنه من الدعم.',
  salaryDateLabel:'تاريخ الراتب',financialGoalLabel:'الهدف المالي',
  goalPH:'مثال: أحتاج المبلغ لشراء سيارة',
  aiOptToggle:'تحسين الترتيب بالذكاء الاصطناعي (اختياري)',
  suggestOrderBtn:'اقترح ترتيباً عادلاً بالذكاء الاصطناعي',
  suggestOrderLoading:'الوكيل الذكي يحلل رواتب وأهداف الأعضاء...',
  turnReasonsTitle:'أسباب الترتيب المقترح',
  applyOrderBtn:'تطبيق هذا الترتيب',
  orderAppliedMsg:'تم تطبيق الترتيب المقترح',
  queuePosLabel:'ترتيبك في الدور',totalPotLabel:'إجمالي الجمعية',
  contractTitle:'العقد الرقمي',
  contractDesc:'قبل بدء الجمعية، راجع ملخص الاتفاق الذي سيوقّعه جميع الأعضاء رقمياً عبر نفاذ.',
  contractMembers:'عدد الأعضاء',contractAmount:'المبلغ الشهري',contractOrder:'ترتيب الاستلام',
  contractPolicy:'سياسة النزاعات',contractPolicyVal:'وساطة تلقائية عبر الوكيل الذكي عند التأخر في الدفع',
  signContractBtn:'التوقيع عبر نفاذ وبدء الجمعية',
  contractSignedMsg:'موقّع رقمياً عبر نفاذ',
  alinmaBadge:'بالشراكة مع مصرف الإنماء',shariahBadge:'متوافق مع الشريعة',
  trustRiskTitle:'الثقة والمخاطر',
  trustRiskDesc:'هذه التقييمات خاصة بك كمنظّم ولا تظهر لبقية الأعضاء. يمكن لأي عضو طلب مراجعة بشرية للقرار.',
  noFlagged:'لا يوجد أعضاء عليهم تنبيه حالياً',
  aiServiceDown:'تعذّر الوصول إلى خدمة الوكلاء الذكية حالياً. حاول مرة أخرى بعد قليل.',
  serverDownError:'تعذّر الاتصال بالخادم. تأكد من تشغيل agent_server.py على جهازك.',
  reqReviewBtn:'الإبلاغ عن خطأ',
  reqReviewSent:'تم إرسال طلبك. سيراجع فريق الدعم القرار خلال ٢٤ ساعة.',
  activityTitle:'نشاط الوكيل الذكي',
  actRiskAssessed:function(n){return 'وكيل المخاطر قيّم انضمام '+n},
  actMediated:function(n){return 'وكيل الوساطة تواصل مع '+n},
  actYield:'وكيل العائد حسب العائد المتوقع على المبلغ المجمّع',
  actTurn:'وكيل الترتيب اقترح ترتيب استلام جديد',
  receiptDateLabel:'التاريخ',receiptMethodLabel:'طريقة الدفع',
},
en:{
  appName:'JameyaTech',appSub:'جمعيتك',
  chooseLanguage:'Choose your language',
  welcomeBack:'Welcome Back',welcomeSub:'Sign in to continue',
  nationalIdLabel:'National ID / Iqama Number',nationalIdPH:'1XXXXXXXXX',
  phoneLabel:'Mobile Number',phonePH:'05XXXXXXXX',
  namePH:'e.g. Mohammed Al-Otaibi',
  errNationalId:'Please enter a valid National ID/Iqama number',
  sendCode:'Send Verification Code',enterCode:'Enter Verification Code',
  codeSentTo:'Code sent to',verify:'Verify',resend:'Resend Code',
  nafath:'Powered by Nafath',errPhone:'Please enter a valid number',
  passwordLabel:'Password',passwordPH:'••••••••',
  errPassword:'Please enter your password',
  errPasswordFormat:'Password must be at least 8 characters',
  passwordHint:'At least 8 characters (letters or numbers)',
  loginBtn:'Sign In',loggingIn:'Signing in...',
  loginError:'Incorrect phone number or password',
  noAccountLink:"Don't have an account? Create one",haveAccountLink:'Already have an account? Sign in',
  signupTitle:'Create Your Account',signupSub:'Enter your details to join JameyaTech',
  createAccountBtn:'Create Account',
  phoneTakenError:'This number is already registered, try signing in',
  signupError:'Could not create account, please try again',
  navCircles:'My Circles',navCreate:'Create',navSettings:'Settings',
  myCircles:'My Circles',noCircles:'No circles yet',
  noCirclesSub:'Tap + to create your first circle',
  roleOrganizer:'Organizer',roleMember:'Member',
  statusActive:'Active',statusWaiting:'Awaiting Confirmation',
  monthlyUnit:'SAR/month',myTurnIn:'My turn in',
  daysLeftLabel:function(n){return n+' days to pay'},
  confirmedOf:function(n,t){return n+'/'+t},
  backBtn:'Circles',nextPayment:'Next Payment',daysUnit:'Days',
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
  riskRedTitle:'Warning — High Risk Member',
  riskYellowTitle:'Caution — Proceed Carefully',
  riskGreenTitle:'Low Risk — Trusted',
  phoneNameMismatch:function(recordName){return 'This phone number is on record under a different name'+(recordName?' ('+recordName+')':'')+' — identity verification recommended.'},
  riskReason:'Reason',riskHistory:'History',
  settingsTitle:'Settings',appearanceSection:'Appearance',
  languageLabel:'Language',textSizeLabel:'Text Size',
  sizeNormal:'Normal',sizeLarge:'Large',sizeXlarge:'Extra Large',
  sizePreview:'This is a font size preview',
  notifSection:'Notifications',notifPayment:'Payment reminders',
  notifGroup:'Group updates',profileSection:'My Profile',
  nameLabel:'Name',phoneLabel2:'Phone',versionLabel:'App Version',
  logoutBtn:'Sign Out',nameVal:'Abdullah',
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
  priceUpdatedMsg:'Price updated and all members notified',
  deleteCircleBtn:'Delete Circle',
  deleteConfirmTitle:'Are you sure?',
  deleteConfirmDesc:'This circle will be permanently deleted. This action cannot be undone.',
  confirmDeleteBtn:'Yes, delete circle',
  priceChangeNotif:function(nm,oldA,newA){return 'The monthly price for "'+nm+'" changed from '+oldA+' to '+newA+' SAR.'},
  circleDeletedNotif:function(nm){return '"'+nm+'" circle has been deleted.'},
  notificationsTitle:'Notifications',noNotifications:'No notifications yet',
  askRiskAgent:'Ask the AI Risk Agent',
  riskAgentLoading:'Analyzing via the AI agent (Groq)...',
  riskAgentTitle:'AI Agent Assessment',
  mediateBtn:'Mediate with AI Agent',
  mediateLoading:'Drafting a resolution via the AI agent...',
  mediateMsgTitle:'Agent Message to Member',
  restructOptionsTitle:'Restructuring Options',
  draftContractTitle:'Draft Agreement',
  yieldCardTitle:'Yield on Pooled Funds',
  yieldDesc:'Calculate potential yield from investing the idle pooled amount in a Shariah-compliant money market fund (AI agent).',
  yieldBtn:'Calculate Yield',
  yieldLoading:'Calculating yield via the AI agent...',
  yieldEarnedLabel:'Yield Earned',yieldNewTotalLabel:'New Total',
  agentErrorPrefix:'⚠️ ',
  valueProp1:'AI-screened member risk',valueProp2:'Automatic fair turn order',valueProp3:'Shariah-compliant yield on pooled funds',
  nafathExplain:"We verify your identity via Nafath to protect every member of the circle from fraud.",
  privacyNote:'Your data is used only for identity verification.',
  otpPrivacy:"We'll never ask you to share this code with anyone, even someone claiming to be support.",
  salaryDateLabel:'Salary Date',financialGoalLabel:'Financial Goal',
  goalPH:'e.g. Saving up for a car',
  aiOptToggle:'AI turn optimization (optional)',
  suggestOrderBtn:'Suggest a fair order with AI',
  suggestOrderLoading:"AI agent is analyzing members' salary dates and goals...",
  turnReasonsTitle:'Why this order',
  applyOrderBtn:'Apply this order',
  orderAppliedMsg:'Suggested order applied',
  queuePosLabel:'Your position in queue',totalPotLabel:'Total circle pot',
  contractTitle:'Digital Agreement',
  contractDesc:'Before starting the circle, review the agreement summary that every member digitally signs via Nafath.',
  contractMembers:'Members',contractAmount:'Monthly Amount',contractOrder:'Payout Order',
  contractPolicy:'Dispute Policy',contractPolicyVal:'Automatic AI-mediated resolution on missed payments',
  signContractBtn:'Sign via Nafath & Start Circle',
  contractSignedMsg:'Digitally signed via Nafath',
  alinmaBadge:'In partnership with Alinma Bank',shariahBadge:'Shariah-compliant',
  trustRiskTitle:'Trust & Risk',
  trustRiskDesc:"These assessments are private to you as organizer and are never shown to other members. Any member can request human review of a decision.",
  noFlagged:'No members currently flagged',
  aiServiceDown:'Could not reach the AI agent service right now. Please try again shortly.',
  serverDownError:'Could not connect to the server. Make sure agent_server.py is running.',
  reqReviewBtn:'Report an issue',
  reqReviewSent:'Your request has been sent. Support will review this decision within 24 hours.',
  activityTitle:'AI Activity',
  actRiskAssessed:function(n){return 'Risk Agent assessed '+n+' joining'},
  actMediated:function(n){return 'Mediator Agent reached out to '+n},
  actYield:'Yield Agent calculated expected return on the pooled funds',
  actTurn:'Turn Agent suggested a new payout order',
  receiptDateLabel:'Date',receiptMethodLabel:'Payment Method',
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
// Circles are now real, shared, server-backed data (see circle_store.py /
// accounts.py) instead of fake per-browser localStorage. DB_KEY still holds
// a local copy, but it's a RENDER CACHE synced from the server (see
// syncCirclesFromServer below), not the source of truth -- every mutation
// updates the cache AND pushes to the server so other logged-in accounts
// can pick it up next time they sync.
var DB_KEY='waj_circles',DB_SET='waj_settings',DB_SESSION='waj_session';

// Session identity and the circles it can see are stored in sessionStorage,
// NOT localStorage -- localStorage is shared across every tab/window of the
// same browser for this origin, so testing multiple accounts as separate
// tabs of one browser would silently fight over the same "who's logged in"
// slot (logging into account B in tab 2 would log tab 1 out from under it).
// sessionStorage is scoped per tab/window instead, while still surviving a
// reload of that same tab -- exactly what "log into a different demo
// account per tab" needs.
function saveSession(s){sessionStorage.setItem(DB_SESSION,JSON.stringify(s));}
function loadSession(){try{return JSON.parse(sessionStorage.getItem(DB_SESSION));}catch(e){return null;}}
function clearSession(){sessionStorage.removeItem(DB_SESSION);}

function syncCirclesFromServer(onDone){
  if(!state.session){if(onDone)onDone();return;}
  fetch(AGENT_API+'/api/circles-for/'+state.session.phone)
    .then(function(r){return r.json();})
    .then(function(list){sessionStorage.setItem(DB_KEY,JSON.stringify(list||[]));if(onDone)onDone();})
    .catch(function(){if(onDone)onDone();}); // offline-safe: keep stale local cache rather than crash
}
function pushCircleToServer(c){
  fetch(AGENT_API+'/api/circle/'+c.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c)}).catch(function(){});
}
function deleteCircleFromServer(id){
  fetch(AGENT_API+'/api/circle/'+id,{method:'DELETE'}).catch(function(){});
}
// Atomic single-member update (accept/decline invite, pay) -- these are the
// operations where two different accounts plausibly touch the same circle
// around the same time, so they skip the fetch-mutate-push-whole-circle
// pattern (which can silently lose one account's update) and hit a
// dedicated server-side read-modify-write instead. See circle_store.update_member.
function updateMyMemberOnServer(circleId,updates,onDone){
  fetch(AGENT_API+'/api/circle/'+circleId+'/member/'+myPhone(),{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(updates)
  }).then(function(r){return r.json();}).then(function(){if(onDone)onDone();}).catch(function(){if(onDone)onDone();});
}

function dbInit(){
  var s=null;try{s=JSON.parse(localStorage.getItem(DB_SET));}catch(e){}
  if(s){state.settings=s;state.lang=s.lang;}
  var sess=loadSession();
  if(sess){state.session=sess;state.phase='app';}
}
function getCircles(){try{return JSON.parse(sessionStorage.getItem(DB_KEY))||[];}catch(e){return[];}}
function getCircle(id){var l=getCircles();for(var i=0;i<l.length;i++){if(l[i].id===id)return l[i];}return null;}
function updateCircle(id,updates){
  var list=getCircles();
  var updated=null;
  for(var i=0;i<list.length;i++){
    if(list[i].id===id){for(var k in updates) list[i][k]=updates[k]; updated=list[i]; break;}
  }
  sessionStorage.setItem(DB_KEY,JSON.stringify(list));
  if(updated)pushCircleToServer(updated);
}
function saveCircle(c){
  var list=getCircles();
  c.id=Date.now();c.currentTurn=0;c.status='waiting';
  c.organizerPhone=state.session.phone;
  list.push(c);
  sessionStorage.setItem(DB_KEY,JSON.stringify(list));
  pushCircleToServer(c);
}
function saveSettings(s){localStorage.setItem(DB_SET,JSON.stringify(s));}
function myPhone(){return state.session?state.session.phone:'';}
function isOrganizer(c){return c.organizerPhone===myPhone();}
function myMember(c){var mp=myPhone();for(var i=0;i<c.members.length;i++){if(c.members[i].phone===mp)return c.members[i];}return null;}
function isInvitation(c){var me=myMember(c);return !isOrganizer(c)&&me&&me.confirmed==='pending';}

var DB_NOTIF='waj_notifications';
function getNotifications(){try{return JSON.parse(sessionStorage.getItem(DB_NOTIF))||[];}catch(e){return[];}}
function addNotification(ar,en){
  var list=getNotifications();
  list.unshift({id:Date.now(),ar:ar,en:en,date:new Date().toISOString(),read:false});
  sessionStorage.setItem(DB_NOTIF,JSON.stringify(list));
}
function markNotificationsRead(){
  var list=getNotifications();
  list.forEach(function(n){n.read=true});
  sessionStorage.setItem(DB_NOTIF,JSON.stringify(list));
}

// ═══════════════════════════════════════════════════════════
// 5. HELPERS
// ═══════════════════════════════════════════════════════════
var $app=document.getElementById('app'),$nav=document.getElementById('nav');
function isA(){return state.lang==='ar'}
function tt(){return T[state.lang]}
function ta(){return isA()?'right':'left'}
function el(id){return document.getElementById(id)}
function setHtml(id,html){var e=el(id);if(e)e.innerHTML=html;return e;}
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
function fmtTime(d){var h=d.getHours(),m=d.getMinutes();return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;}
var MONTHS_AR_FULL=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
var MONTHS_EN_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
// The month a member is due to receive the pot, derived from the circle's
// start date + their position in the (possibly reordered) payout queue --
// computed per logged-in account rather than stored, since "my turn" now
// depends on which of possibly several real accounts is asking.
function computeMyTurnLabel(c){
  var me=myMember(c);
  if(!me||c.status!=='active')return '—';
  var d=addMonths(c.startDate,me.turn-1);
  return isA()?MONTHS_AR_FULL[d.getMonth()]:MONTHS_EN_FULL[d.getMonth()];
}
// Deadline for this cycle's contribution = start of the *next* turn's month
// (c.currentTurn is 1-indexed, so addMonths(start, currentTurn) lands on the
// month after the current one). Computed live from real dates every render
// instead of a stored field, so it's never stale and needs no manual update
// after paying or on any other action.
function computeDueDate(c){return addMonths(c.startDate,c.currentTurn);}
function computeDaysLeft(c){
  if(c.status!=='active')return 0;
  var due=computeDueDate(c);due.setHours(0,0,0,0);
  var today=new Date();today.setHours(0,0,0,0);
  var days=Math.round((due-today)/86400000);
  return days>0?days:0;
}

// ═══════════════════════════════════════════════════════════
// 5b. ICON SYSTEM — small inline SVG set replacing structural emoji
// ═══════════════════════════════════════════════════════════
var ICONS={
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>',
  plus:'<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  settings:'<line x1="4" y1="6" x2="20" y2="6"/><circle cx="15" cy="6" r="2"/><line x1="4" y1="12" x2="20" y2="12"/><circle cx="9" cy="12" r="2"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="16" cy="18" r="2"/>',
  back:'<polyline points="15 18 9 12 15 6"/>',
  bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  shield:'<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z"/>',
  chat:'<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  trend:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  check:'<polyline points="20 6 9 17 4 12"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  clock:'<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  sparkles:'<path d="M12 2l1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2z"/><path d="M19 15l.7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15z"/>',
  users:'<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  alert:'<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
  file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
  bank:'<line x1="3" y1="21" x2="21" y2="21"/><line x1="6" y1="21" x2="6" y2="9"/><line x1="10" y1="21" x2="10" y2="9"/><line x1="14" y1="21" x2="14" y2="9"/><line x1="18" y1="21" x2="18" y2="9"/><polygon points="12 2 21 8 3 8"/>',
  user:'<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
  info:'<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
  card:'<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>'
};
function icon(name,size,cls){size=size||18;return '<svg class="ic'+(cls?' '+cls:'')+'" width="'+size+'" height="'+size+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(ICONS[name]||'')+'</svg>';}
function iconCirc(name,size,bg,fg){return '<div class="ic-circ" style="'+(bg?'background:'+bg+';':'')+(fg?'color:'+fg+';':'')+'">'+icon(name,size||18)+'</div>';}

// ═══════════════════════════════════════════════════════════
// 5c. UNIFIED AI AGENT CARD — one visual language for all 4 agents
// ═══════════════════════════════════════════════════════════
var AGENT_META={
  risk:{icon:'shield',nameAr:'وكيل المخاطر',nameEn:'Risk Agent'},
  turn:{icon:'sparkles',nameAr:'وكيل الترتيب',nameEn:'Turn Agent'},
  yield:{icon:'trend',nameAr:'وكيل العائد',nameEn:'Yield Agent'},
  mediator:{icon:'chat',nameAr:'وكيل الوساطة',nameEn:'Mediator Agent'}
};
function aiCardShell(agentKey,innerHtml,showReview){
  var l=tt(),meta=AGENT_META[agentKey],now=fmtTime(new Date());
  return '<div class="cd-ai"><div class="ai-head" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
    '<div class="ai-ic">'+icon(meta.icon,17)+'</div>'+
    '<div style="flex:1;text-align:'+ta()+'"><p class="ai-name">'+(isA()?meta.nameAr:meta.nameEn)+'</p></div>'+
    '<p class="ai-time">'+now+'</p></div>'+
    innerHtml+
    (showReview?'<button class="ai-review req-review" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+icon('alert',13)+tt().reqReviewBtn+'</button>':'')+
    '</div>';
}
function bindReviewLinks(){
  qa('.req-review').forEach(function(btn){
    if(btn._bound)return;btn._bound=true;
    btn.addEventListener('click',function(){
      btn.outerHTML='<p class="ts cm" style="margin-top:10px">'+icon('check',13)+' '+tt().reqReviewSent+'</p>';
    });
  });
}
// Maps the Python function names the Orchestrator's tool-calling router can
// invoke (see orchestrator.py's AGENT_FUNCTIONS) to the AGENT_META keys above.
var FN_TO_AGENT={assess_risk:'risk',assign_turns:'turn',calculate_yield:'yield',mediate_missed_payment:'mediator'};

function renderStepBody(step){
  var l=tt(),r=step.result||{},agentKey=FN_TO_AGENT[step.agent]||'mediator';
  if(step.error||r.error){
    return '<p class="ts cr" style="display:flex;align-items:center;gap:6px">'+icon('alert',14)+' '+(r.error||step.error)+'</p>';
  }
  if(agentKey==='risk'){
    var isR=r.risk_level==='red',isY=r.risk_level==='yellow',cls=isR?'rd':(isY?'yl':'gr');
    var verdictTxt=isR?l.riskRedTitle:(isY?l.riskYellowTitle:l.riskGreenTitle);
    return '<div class="ai-verdict '+cls+'">'+verdictTxt+'</div><p class="ts ct">'+(r.reason||'')+'</p>';
  }
  if(agentKey==='turn'){
    var rows='';
    (r.turn_order||[]).forEach(function(o){rows+='<div style="padding:6px 0;border-bottom:1px solid var(--border)"><p class="ts b7 ct">'+o.month+'. '+o.name+'</p><p class="tx cm">'+(o.reason||'')+'</p></div>';});
    return rows||'<p class="ts cm">—</p>';
  }
  if(agentKey==='yield'){
    return '<p class="ts ct" dir="ltr">+'+r.yield_earned+' → '+r.new_total+'</p><p class="ts cm">'+(r.explanation||'')+'</p>';
  }
  var optsHtml='';
  (r.restructuring_options||[]).forEach(function(opt,i){optsHtml+='<p class="ts ct" style="margin-top:4px"><strong>'+(i+1)+'.</strong> '+opt+'</p>';});
  return '<p class="ts ct">'+(r.message_to_member||'')+'</p>'+optsHtml;
}

// Renders the {steps, summary} shape returned by the Orchestrator's agentic
// router (POST /api/route) -- one card per agent it decided to chain,
// followed by its own natural-language summary of what it did and why.
function renderChainedResult(steps,summary){
  var l=tt(),rows='';
  steps.forEach(function(step){
    var meta=AGENT_META[FN_TO_AGENT[step.agent]]||AGENT_META.mediator;
    rows+='<div class="cd-ai" style="margin-top:10px"><div class="ai-head" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<div class="ai-ic">'+icon(meta.icon,17)+'</div><div style="flex:1;text-align:'+ta()+'"><p class="ai-name">'+(isA()?meta.nameAr:meta.nameEn)+'</p></div></div>'+
      renderStepBody(step)+'</div>';
  });
  rows+='<div class="cd" style="margin-top:10px;background:var(--primary-lt);border:none"><p class="ts b7 ct" style="text-align:'+ta()+'">'+(summary||'')+'</p></div>';
  rows+='<button class="ai-review req-review" style="margin-top:6px;'+(isA()?'flex-direction:row-reverse;':'')+'">'+icon('alert',13)+l.reqReviewBtn+'</button>';
  return rows;
}

function skeletonHtml(lines){
  lines=lines||3;var h='<div class="skel-wrap">';
  for(var i=0;i<lines;i++)h+='<div class="skel-row" style="width:'+(100-i*18)+'%"></div>';
  return h+'</div>';
}

// ═══════════════════════════════════════════════════════════
// 5d. ACTIVITY TIMELINE — makes the Orchestrator's chained decisions visible
// ═══════════════════════════════════════════════════════════
var DB_ACT='waj_activity';
function getActivityAll(){try{return JSON.parse(sessionStorage.getItem(DB_ACT))||{};}catch(e){return {};}}
function addActivity(circleId,agentKey,ar,en){
  var all=getActivityAll();
  if(!all[circleId])all[circleId]=[];
  all[circleId].unshift({agent:agentKey,ar:ar,en:en,ts:Date.now()});
  all[circleId]=all[circleId].slice(0,12);
  sessionStorage.setItem(DB_ACT,JSON.stringify(all));
}
function renderTimeline(circleId){
  var l=tt(),list=(getActivityAll()[circleId]||[]);
  if(list.length===0)return '';
  var rows='';
  list.forEach(function(a){
    var meta=AGENT_META[a.agent]||AGENT_META.risk;
    rows+='<div class="tl-item"><div class="tl-dot">'+icon(meta.icon,14)+'</div>'+
      '<div class="tl-body"><p class="tl-txt">'+(isA()?a.ar:a.en)+'</p>'+
      '<p class="tl-time">'+fmtTime(new Date(a.ts))+'</p></div></div>';
  });
  return '<div class="cd"><p class="st">'+l.activityTitle+'</p><div class="timeline">'+rows+'</div></div>';
}

// ═══════════════════════════════════════════════════════════
// 6. SCREENS
// ═══════════════════════════════════════════════════════════

// ── Language ──────────────────────────────────────────────
function scrLanguage(){
  $app.innerHTML='<div class="cen">'+logoHtml()+
    '<p class="txl b8 ct tc" style="margin-bottom:6px">اختر لغتك</p>'+
    '<p class="tb cm tc" style="margin-bottom:24px">Choose your language</p>'+
    '<div class="vstrip">'+
    '<div class="vchip">'+iconCirc('shield',16)+'<p>فحص المخاطر بالذكاء الاصطناعي · AI risk screening</p></div>'+
    '<div class="vchip">'+iconCirc('sparkles',16)+'<p>ترتيب دور عادل تلقائياً · Fair automatic turn order</p></div>'+
    '<div class="vchip">'+iconCirc('trend',16)+'<p>عائد شرعي على المبلغ المجمّع · Shariah-compliant yield</p></div>'+
    '</div>'+
    '<div style="width:100%">'+
    '<button id="la" class="lbtn" style="flex-direction:row-reverse"><span style="font-size:28px">🇸🇦</span><div style="text-align:right"><p class="txl b9 ct">العربية</p><p class="ts cm">Arabic</p></div></button>'+
    '<button id="le" class="lbtn"><div style="text-align:left"><p class="txl b9 ct">English</p><p class="ts cm">الإنجليزية</p></div><span style="font-size:28px">🌐</span></button></div></div>';
  on('la','click',function(){setState({lang:'ar',phase:'login',settings:Object.assign({},state.settings,{lang:'ar'})})});
  on('le','click',function(){setState({lang:'en',phase:'login',settings:Object.assign({},state.settings,{lang:'en'})})});
}

// ── Login (real accounts -- see accounts.py) ────────────────
function scrLogin(){
  var l=tt();
  $app.innerHTML='<div class="auth">'+logoHtml()+
    '<div style="text-align:'+ta()+';margin-bottom:20px"><h2 class="t2 b9 ct" style="margin-bottom:6px">'+l.welcomeBack+'</h2><p class="tb cm">'+l.welcomeSub+'</p></div>'+
    '<div class="fg"><label class="fl">'+l.phoneLabel+'</label><div class="phr"><div class="phx"><span>🇸🇦</span><span>+966</span></div><input id="lphi" type="tel" inputmode="numeric" dir="ltr" class="fi f1" placeholder="'+l.phonePH+'" maxlength="10" value="'+(state.loginPhone||'')+'" /></div></div>'+
    '<div class="fg"><label class="fl">'+l.passwordLabel+'</label><input id="lpin" type="password" dir="ltr" class="fi" placeholder="'+l.passwordPH+'" /></div>'+
    '<p id="pe" class="ts cr" style="margin-top:-8px;margin-bottom:8px;display:none;text-align:'+ta()+'"></p>'+
    '<div class="f row g10" style="'+(isA()?'flex-direction:row-reverse;':'')+'background:var(--primary-lt);border-radius:14px;padding:12px 14px;margin-bottom:8px">'+
    icon('lock',17,'cp')+'<p class="tx cm" style="text-align:'+ta()+'">'+l.nafathExplain+'</p></div>'+
    '<div style="flex:1"></div><div class="fc g12"><button id="bsc" class="bp">'+l.loginBtn+'</button>'+
    '<button id="btoSignup" class="bg-btn">'+l.noAccountLink+'</button>'+
    '<div class="tc"><span class="trust-badge">'+iconCirc('lock',12)+l.nafath+'</span></div>'+
    '<p class="tx cm tc">'+l.privacyNote+'</p></div></div>';
  on('lphi','input',function(){state.loginPhone=el('lphi').value.replace(/\D/g,'').slice(0,10)});
  on('lpin','input',function(){state.loginPassword=el('lpin').value});
  on('btoSignup','click',function(){setState({phase:'signup'})});
  on('bsc','click',function(){
    var p=(el('lphi').value||'').replace(/\D/g,'');
    var pw=el('lpin').value||'';
    if(p.length<9){el('pe').textContent=l.errPhone;el('pe').style.display='block';return;}
    if(!pw){el('pe').textContent=l.errPassword;el('pe').style.display='block';return;}
    el('pe').style.display='none';
    el('bsc').disabled=true;el('bsc').textContent=l.loggingIn;
    callAgent({phone:p,password:pw},function(result,err){
      if(err||!result||!result.phone){
        el('bsc').disabled=false;el('bsc').textContent=l.loginBtn;
        el('pe').textContent=(err===agentUnreachableMsg())?l.serverDownError:l.loginError;
        el('pe').style.display='block';return;
      }
      state.session=result;
      saveSession(result);
      syncCirclesFromServer(function(){setState({phase:'app',tab:'circles'})});
    },'/api/login');
  });
}

// ── Signup: name / national ID / phone / password ─────────────
function scrSignup(){
  var l=tt();
  $app.innerHTML='<div class="auth">'+logoHtml()+
    '<div style="text-align:'+ta()+';margin-bottom:20px"><h2 class="t2 b9 ct" style="margin-bottom:6px">'+l.signupTitle+'</h2><p class="tb cm">'+l.signupSub+'</p></div>'+
    '<div class="fg"><label class="fl">'+l.nameLabel+'</label><input id="suName" type="text" dir="'+(isA()?'rtl':'ltr')+'" class="fi" placeholder="'+l.namePH+'" value="'+(state.signupName||'')+'" /></div>'+
    '<div class="fg"><label class="fl">'+l.nationalIdLabel+'</label><input id="suNid" type="text" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.nationalIdPH+'" maxlength="10" value="'+(state.signupNid||'')+'" /></div>'+
    '<div class="fg"><label class="fl">'+l.phoneLabel+'</label><div class="phr"><div class="phx"><span>🇸🇦</span><span>+966</span></div><input id="suPhone" type="tel" inputmode="numeric" dir="ltr" class="fi f1" placeholder="'+l.phonePH+'" maxlength="10" value="'+(state.signupPhone||'')+'" /></div></div>'+
    '<div class="fg"><label class="fl">'+l.passwordLabel+'</label><input id="suPw" type="password" dir="ltr" class="fi" placeholder="'+l.passwordPH+'" />'+
    '<p class="ts cm" style="margin-top:6px">'+l.passwordHint+'</p></div>'+
    '<p id="se1" class="ts cr" style="margin-top:-8px;margin-bottom:8px;display:none;text-align:'+ta()+'"></p>'+
    '<div style="flex:1"></div><div class="fc g12"><button id="bsuCreate" class="bp">'+l.createAccountBtn+'</button>'+
    '<button id="bsuToLogin" class="bg-btn">'+l.haveAccountLink+'</button></div></div>';
  on('suName','input',function(){state.signupName=el('suName').value});
  on('suNid','input',function(){state.signupNid=el('suNid').value.replace(/\D/g,'').slice(0,10)});
  on('suPhone','input',function(){state.signupPhone=el('suPhone').value.replace(/\D/g,'').slice(0,10)});
  on('bsuToLogin','click',function(){setState({phase:'login'})});
  on('bsuCreate','click',function(){
    var name=(el('suName').value||'').trim();
    var nid=(el('suNid').value||'').replace(/\D/g,'');
    var p=(el('suPhone').value||'').replace(/\D/g,'');
    var pw=el('suPw').value||'';
    if(!name){el('se1').textContent=l.errFillAll;el('se1').style.display='block';return;}
    if(nid.length<10){el('se1').textContent=l.errNationalId;el('se1').style.display='block';return;}
    if(p.length<9){el('se1').textContent=l.errPhone;el('se1').style.display='block';return;}
    if(pw.length<8){el('se1').textContent=l.errPasswordFormat;el('se1').style.display='block';return;}
    el('se1').style.display='none';
    el('bsuCreate').disabled=true;el('bsuCreate').textContent=l.loggingIn;
    callAgent({phone:p,national_id:nid,name:name,password:pw},function(result,err){
      el('bsuCreate').disabled=false;el('bsuCreate').textContent=l.createAccountBtn;
      if(err||!result||!result.phone){
        el('se1').textContent=(err===agentUnreachableMsg())?l.serverDownError:((err&&/registered/i.test(err))?l.phoneTakenError:l.signupError);
        el('se1').style.display='block';return;
      }
      state.session=result;
      saveSession(result);
      setState({signupName:'',signupNid:'',signupPhone:''});
      syncCirclesFromServer(function(){setState({phase:'app',tab:'circles'})});
    },'/api/register');
  });
}

// ── Circles list ──────────────────────────────────────────
function scrCircles(){
  var l=tt(),all=getCircles(),invites=all.filter(isInvitation);
  var circles=all.filter(function(c){
    if(isInvitation(c))return false;
    var me=myMember(c);
    return !(me&&me.confirmed==='declined'); // hide circles I declined -- still intact for everyone else
  });
  // Active circles first, soonest payment due first; not-yet-started
  // circles after, ordered by their intended start date.
  circles.sort(function(a,b){
    var aWaiting=a.status==='waiting',bWaiting=b.status==='waiting';
    if(aWaiting!==bWaiting)return aWaiting?1:-1;
    var aKey=aWaiting?new Date(a.startDate).getTime():computeDueDate(a).getTime();
    var bKey=bWaiting?new Date(b.startDate).getTime():computeDueDate(b).getTime();
    return aKey-bKey;
  });
  var h='',ih='';

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
    h='<div class="cd" style="text-align:center;padding:40px 20px"><div class="empty-ic">'+icon('users',30)+'</div><p class="tl b7 ct" style="margin-bottom:8px">'+l.noCircles+'</p><p class="tb cm">'+l.noCirclesSub+'</p></div>';
  } else {
    circles.forEach(function(c){
      var nm=isA()?c.ar:c.en,isOrg=isOrganizer(c);
      var conf=c.members.filter(function(m){return m.confirmed==='confirmed'}).length;
      var isWaiting=c.status==='waiting';
      var unpd=c.members.filter(function(m){return !m.paid&&m.turn<c.currentTurn}).length;
      var ok=isWaiting?false:unpd===0;
      var turnM=computeMyTurnLabel(c);
      var statusBadge=isWaiting
        ? '<span class="bz bz-pu">'+l.statusWaiting+'</span>'
        : '<span class="bz '+(ok?'bz-gr':'bz-yl')+'">'+(ok?l.statusActive:'!')+'</span>';
      var statsHtml=isWaiting
        ? '<div class="cstats"><div class="cstat"><p class="csv">'+c.amount+'</p><p class="csl">'+l.monthlyUnit+'</p></div>'+
          '<div class="cstat"><p class="csv tb" dir="ltr">'+l.confirmedOf(conf,c.members.length)+'</p><p class="csl">'+(isA()?'أكدوا':'Confirmed')+'</p></div>'+
          '<div class="cstat"><p class="csv" style="color:var(--gold)">'+turnM+'</p><p class="csl">'+l.myTurnIn+'</p></div></div>'
        : '<div class="cstats" style="grid-template-columns:1fr 1fr"><div class="cstat"><p class="csv">'+c.amount+'</p><p class="csl">'+l.monthlyUnit+'</p></div>'+
          '<div class="cstat"><p class="csv" style="color:var(--gold)">'+turnM+'</p><p class="csl">'+l.myTurnIn+'</p></div></div>';

      h+='<div class="cd cd-click cc" data-cid="'+c.id+'">'+
        '<div class="f row jb as" style="margin-bottom:10px"><div style="text-align:'+ta()+';flex:1">'+
        '<p class="tl b8 ct" style="margin-bottom:6px">'+nm+'</p>'+
        '<div class="f row g8" style="flex-wrap:wrap"><span class="bz '+(isOrg?'bz-go':'bz-pr')+'">'+(isOrg?l.roleOrganizer:l.roleMember)+'</span>'+statusBadge+'</div></div>'+
        '<span class="cm txl" style="margin-'+(isA()?'right':'left')+':8px">›</span></div>'+
        statsHtml+
        (isWaiting?'':'<p class="ts cm" style="text-align:'+ta()+';margin-top:8px;font-weight:600">'+icon('clock',13)+' '+l.daysLeftLabel(computeDaysLeft(c))+'</p>')+
        '</div>';
    });
  }
  var invitesBlock=invites.length>0?'<p class="slbl" style="text-align:'+ta()+';margin-top:0">'+l.invitationsTitle+'</p>'+ih:'';
  var unread=getNotifications().filter(function(n){return !n.read}).length;
  var bellHtml='<button id="bbell" class="bell-btn">'+icon('bell',18)+(unread>0?'<span class="bell-dot"></span>':'')+'</button>';
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
    h='<div class="cd" style="text-align:center;padding:40px 20px"><div class="empty-ic">'+icon('bell',28)+'</div><p class="tb cm">'+l.noNotifications+'</p></div>';
  } else {
    list.forEach(function(n){
      h+='<div class="cd" style="text-align:'+ta()+'"><p class="tb b7 ct">'+(isA()?n.ar:n.en)+'</p>'+
        '<p class="tx cm" style="margin-top:6px">'+fmtDate(n.date.slice(0,10))+'</p></div>';
    });
  }
  markNotificationsRead();
  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbknotif">'+icon('back',15,'ic-back')+l.backBtn+'</button>'+
    '<h1 style="text-align:'+ta()+'">'+l.notificationsTitle+'</h1></div><div class="body">'+h+'</div></div>';
  on('bbknotif','click',function(){setState({notifView:false})});
}

function respondInvite(circleId,accept){
  // Marks only the current account's own membership status -- this circle
  // is shared with other real accounts now, so declining must NOT delete
  // it for the organizer/other members, only hide it from your own list
  // (see the "declined" filter in scrCircles). Goes through the atomic
  // per-member endpoint, not updateCircle's full-blob push: two members
  // can plausibly respond to the same invite within moments of each other,
  // and a full-blob push would risk one overwriting the other's answer.
  var list=getCircles(),c=null;
  for(var i=0;i<list.length;i++){if(list[i].id===circleId){c=list[i];break;}}
  if(!c)return;
  var me=myMember(c);if(!me)return;
  me.confirmed=accept?'confirmed':'declined'; // optimistic local update for instant UI feedback
  sessionStorage.setItem(DB_KEY,JSON.stringify(list));
  updateMyMemberOnServer(circleId,{confirmed:me.confirmed});
  setState({});
}

// ── Circle detail ─────────────────────────────────────────
function scrDetail(){
  var l=tt(),c=getCircle(state.activeCircleId);
  if(!c){setState({activeCircleId:null});return;}

  var isOrg=isOrganizer(c);
  var myPh=myPhone();
  var sorted=c.members.slice().sort(function(a,b){return a.turn-b.turn});
  var curM=null; c.members.forEach(function(m){if(m.turn===c.currentTurn)curM=m});
  var conf=c.members.filter(function(m){return m.confirmed==='confirmed'}).length;
  var allConfirmed=conf===c.members.length;
  var isWaiting=c.status==='waiting';
  var unpaid=c.members.filter(function(m){return !m.paid&&m.turn<c.currentTurn});
  var ok=isWaiting?false:unpaid.length===0;
  var unpN=unpaid.map(function(m){return isA()?m.ar:m.en}).join(isA()?' و':' & ');
  var nm=isA()?c.ar:c.en;
  var turnM=computeMyTurnLabel(c);
  var pot=c.amount*c.totalTurns;
  var meMember=myMember(c);
  var iNeedToPay=!isWaiting&&meMember&&!meMember.paid&&meMember.turn!==c.currentTurn;
  var detail='';

  if(state.payMode==='form')return scrPay(c);
  if(state.payMode==='success')return scrPaySuccess(c);
  if(state.contractView==='preview')return scrContract(c);
  if(state.contractView==='signed')return scrContractSigned(c);

  // ── WAITING STATE ──
  if(isWaiting){
    var pct=Math.round((conf/c.members.length)*100);

    // Locked banner
    detail+='<div class="locked-overlay"><div class="locked-icon">'+icon('lock',26)+'</div>'+
      '<p class="tl b8 ct" style="margin-bottom:6px">'+l.waitingTitle+'</p>'+
      '<p class="ts cm" style="margin-bottom:12px">'+l.waitingDesc+'</p>'+
      '<p class="tm b7 ct">'+l.confirmProgress+'</p>'+
      '<p class="t2 b9 cp" dir="ltr" style="margin-top:4px">'+conf+' / '+c.members.length+'</p>'+
      '<div class="prog-bar"><div class="prog-fill" style="width:'+pct+'%"></div></div></div>';

    // Start date
    detail+='<div class="cd"><div class="date-display"><span style="color:var(--primary)">'+icon('calendar',22)+'</span>'+
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
        '<p class="ts cm" style="margin-bottom:14px">'+l.turnOrderDesc+'</p>'+
        '<button id="bsuggestOrder" class="bo f row g6 ac jc" style="margin-bottom:16px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('sparkles',15)+l.suggestOrderBtn+'</button>'+
        '<div id="turnAiResult"></div>'+
        '<div id="sortableList">';
      sorted.forEach(function(m){
        var n=isA()?m.ar:m.en;
        detail+='<div class="mr sortable-row" data-mid="'+m.id+'" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
          '<div class="drag-handle">⠿</div>'+
          '<div class="turn-num '+((m.phone===myPh)?'turn-num-me':'turn-num-def')+'">'+m.turn+'</div>'+
          '<div class="mav" style="width:36px;height:36px;font-size:13px">'+m.init+'</div>'+
          '<div style="flex:1;text-align:'+ta()+'"><p class="tb '+((m.phone===myPh)?'b8':'b6')+' ct">'+n+((m.phone===myPh)?' <span class="cm ts">'+l.youLabel+'</span>':'')+'</p></div>'+
          '</div>';
      });
      detail+='</div>'+
        '<button id="btglAdd" class="bg-btn" style="margin-top:8px">'+l.addMemberToggle+'</button>'+
        '<div id="addMemberForm" style="display:none;margin-top:8px;direction:'+(isA()?'rtl':'ltr')+'">'+
        '<div class="fg"><label class="fl">'+l.memberNameLabel+'</label><input id="dmn" type="text" class="fi" placeholder="'+l.memberNamePH+'" /></div>'+
        '<div class="fg" style="margin-bottom:0"><label class="fl">'+l.memberPhoneLabel+'</label><input id="dmp" type="tel" inputmode="numeric" dir="ltr" class="fi" placeholder="'+l.memberPhonePH+'" maxlength="10" /></div>'+
        '<div id="dra"></div><div id="draAi" style="margin-top:10px"></div>'+
        '<button id="dbaAi" class="bg-btn f row g6 ac jc" style="display:none;margin-top:4px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('sparkles',14)+l.askRiskAgent+'</button>'+
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
        '<p id="priceMsg" class="ts" style="color:var(--green);margin-top:10px;display:none;text-align:'+ta()+'">'+icon('check',13)+' '+l.priceUpdatedMsg+'</p>'+
        '<div style="border-top:1px solid var(--border);margin:16px 0"></div>'+
        '<button id="btglDelete" class="bd">'+l.deleteCircleBtn+'</button>'+
        '<div id="deleteConfirm" style="display:none;margin-top:12px;text-align:'+ta()+'">'+
        '<p class="tm b8" style="color:var(--red)">'+l.deleteConfirmTitle+'</p>'+
        '<p class="ts cm" style="margin:6px 0 12px">'+l.deleteConfirmDesc+'</p>'+
        '<div class="f row g10"><button id="bconfirmDelete" class="bd" style="flex:1">'+l.confirmDeleteBtn+'</button>'+
        '<button id="bcancelDelete" class="bg-btn" style="flex:1">'+l.cancelBtn+'</button></div></div>'+
        '</div>';

      // Trust & Risk — private to the organizer; individual risk flags are never shown to other members
      var flagged=c.members.filter(function(m){return m.risk==='red'||m.risk==='yellow'});
      var flaggedHtml='';
      if(flagged.length===0){
        flaggedHtml='<p class="ts cm">'+l.noFlagged+'</p>';
      } else {
        flagged.forEach(function(m){
          flaggedHtml+='<div class="f row jb ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'padding:10px 0;border-bottom:1px solid var(--border)"><p class="tb b7 ct">'+(isA()?m.ar:m.en)+'</p><span class="bz '+(m.risk==='red'?'bz-rd':'bz-yl')+'">'+(m.risk==='red'?l.riskRedTitle:l.riskYellowTitle)+'</span></div>';
        });
      }
      detail+='<div class="cd"><p class="st f row g8 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+icon('shield',17)+l.trustRiskTitle+'</p>'+
        '<p class="ts cm" style="margin-bottom:12px">'+l.trustRiskDesc+'</p>'+flaggedHtml+'</div>';
    }

  // ── ACTIVE STATE ──
  } else {
    // Status banner
    detail+='<div class="cd '+(ok?'cd-gr':'cd-yl')+'"><div class="f row g14 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<div style="width:52px;height:52px;border-radius:50%;flex-shrink:0;background:'+(ok?'var(--green)':'var(--yellow)')+';display:flex;align-items:center;justify-content:center;font-size:26px;color:#fff;font-weight:900">'+(ok?'✓':'!')+'</div>'+
      '<div style="flex:1;text-align:'+ta()+'"><p class="tl b8 ct">'+(ok?l.allGood:l.hasDelay)+'</p>'+
      (!ok?'<p class="ts" style="margin-top:5px;color:var(--yellow);font-weight:600">'+l.handlingIt(unpN)+'</p>':'')+
      '</div></div>'+
      (!ok?'<button id="bmediate" class="bg-btn f row g6 ac jc" style="margin-top:6px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('chat',14)+l.mediateBtn+'</button><div id="mediateResult" style="margin-top:10px"></div>':'')+
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
    detail+='<div class="cd"><div class="date-display"><span style="color:var(--primary)">'+icon('calendar',22)+'</span>'+
      '<div style="flex:1;text-align:'+ta()+'"><p class="tx cm">'+l.startDateDisplay+'</p>'+
      '<p class="tm b7 ct">'+fmtDate(c.startDate)+'</p></div></div></div>';

    // Stats
    detail+='<div class="twoc"><div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.nextPayment+'</p><p class="t4 b9 cp">'+computeDaysLeft(c)+'</p><p class="tx cm">'+l.daysUnit+'</p></div>'+
      '<div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.myTurnLabel+'</p><p class="txl b9 cg">'+turnM+'</p><p class="tx cm">'+l.youReceive+': SAR '+pot+'</p></div></div>';

    // Current turn
    detail+='<div class="cd"><p class="st">'+l.currentTurn+' · '+l.turnOf(c.currentTurn,c.totalTurns)+'</p>'+
      '<div style="background:var(--primary-lt);border-radius:14px;padding:14px 16px;display:flex;justify-content:space-between;align-items:center;'+(isA()?'flex-direction:row-reverse;':'')+'">'+
      '<div style="text-align:'+ta()+'"><p class="tl b8 ct">'+(curM?(isA()?curM.ar:curM.en):'—')+'</p><p class="tx cm">'+l.potLabel+'</p></div>'+
      '<p class="txl b9 cp" dir="ltr">SAR '+pot+'</p></div></div>';

    // Yield Agent — potential earnings on the idle pooled amount
    detail+='<div class="cd"><p class="st">'+l.yieldCardTitle+'</p>'+
      '<p class="ts cm" style="margin-bottom:14px">'+l.yieldDesc+'</p>'+
      '<button id="byield" class="bo f row g6 ac jc" style="'+(isA()?'flex-direction:row-reverse;':'')+'">'+icon('trend',15)+l.yieldBtn+'</button>'+
      '<div id="yieldResult" style="margin-top:12px"></div></div>';

    // Orchestrator activity — makes the multi-agent system's chained work visible
    detail+=renderTimeline(c.id);

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
        '<div style="flex:1;text-align:'+ta()+'"><p class="tb '+((m.phone===myPh)?'b8':'b6')+' ct">'+n+((m.phone===myPh)?' <span class="cm ts">'+l.youLabel+'</span>':'')+'</p></div>'+
        '<div style="min-width:60px;display:flex;justify-content:center"><div class="turn-num '+((m.phone===myPh)?'turn-num-me':'turn-num-def')+'">'+m.turn+'</div></div>'+
        '<div style="min-width:80px;display:flex;justify-content:center">'+payHtml+'</div></div>';
    });
    detail+='<div class="cd"><div class="f row jb ac" style="margin-bottom:14px;'+(isA()?'flex-direction:row-reverse;':'')+'"><p class="st" style="margin-bottom:0">'+l.membersTitle+'</p></div>'+cols+rows+'</div>';
  }

  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbk">'+icon('back',15,'ic-back')+l.backBtn+'</button>'+
    '<p class="htop" style="text-align:'+ta()+'">'+(isOrg?l.roleOrganizer:l.roleMember)+' · '+(isWaiting?l.statusWaiting:l.turnOf(c.currentTurn,c.totalTurns))+'</p>'+
    '<h1 style="text-align:'+ta()+'">'+nm+'</h1></div><div class="body">'+detail+'</div></div>';

  // Bindings
  on('bbk','click',function(){syncCirclesFromServer(function(){setState({activeCircleId:null,payMode:'off',contractView:'off'})})});

  // Pay now
  on('bgopay','click',function(){setState({payMode:'form'})});

  // Mediator Agent — draft a resolution for the first unpaid member
  on('bmediate','click',function(){
    el('mediateResult').innerHTML=skeletonHtml(3);
    var target=unpaid[0];
    if(!target)return;
    var mName=isA()?target.ar:target.en;
    // Free-text handed to the Orchestrator's agentic router (POST /api/route)
    // instead of the single-agent /api/event path -- lets the LLM decide to
    // chain the Mediator Agent with a Risk Agent re-check in one turn, and
    // makes that chaining visible in the UI via renderChainedResult below.
    var msg=isA()
      ?('العضو '+mName+' تأخر عن دفع اشتراك هذا الشهر ('+c.amount+' ريال) في جمعية «'+nm+'». تواصل معه بلطف واقترح حلولاً لإعادة الجدولة، وتحقق مما إذا كان ينبغي تحديث مستوى المخاطر الخاص به.')
      :(mName+" missed this month's payment ("+c.amount+' SAR) in the "'+nm+'" circle. Reach out to them, propose restructuring options, and check whether their risk level should be updated.');
    callAgent({message:msg},function(result,err){
      if(err){console.error('Orchestrator error:',err);setHtml('mediateResult',aiCardShell('mediator','<p class="ts cr" style="display:flex;align-items:center;gap:6px">'+icon('alert',15)+' '+l.aiServiceDown+'</p>',false));return;}
      var steps=(result&&result.steps)||[];
      if(!setHtml('mediateResult',renderChainedResult(steps,result&&result.summary)))return;
      bindReviewLinks();
      steps.forEach(function(step){
        var agentKey=FN_TO_AGENT[step.agent];
        if(agentKey==='mediator')addActivity(c.id,'mediator',T.ar.actMediated(target.ar),T.en.actMediated(target.en));
        else if(agentKey==='risk')addActivity(c.id,'risk',T.ar.actRiskAssessed(target.ar),T.en.actRiskAssessed(target.en));
        else if(agentKey==='turn')addActivity(c.id,'turn',T.ar.actTurn,T.en.actTurn);
        else if(agentKey==='yield')addActivity(c.id,'yield',T.ar.actYield,T.en.actYield);
      });
    },'/api/route');
  });

  // Yield Agent
  on('byield','click',function(){
    el('yieldResult').innerHTML=skeletonHtml(2);
    var payload={event_type:'calculate_yield',pooled_amount:pot,months_idle:c.currentTurn||1};
    callAgent(payload,function(result,err){
      if(err){console.error('Yield Agent error:',err);setHtml('yieldResult',aiCardShell('yield','<p class="ts cr" style="display:flex;align-items:center;gap:6px">'+icon('alert',15)+' '+l.aiServiceDown+'</p>',false));return;}
      var y=(result&&result.result)||{};
      var inner='<div class="twoc" style="margin-bottom:12px"><div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.yieldEarnedLabel+'</p><p class="tl b9" style="color:var(--gold)" dir="ltr">+'+y.yield_earned+'</p></div>'+
        '<div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.yieldNewTotalLabel+'</p><p class="tl b9 cp" dir="ltr">'+y.new_total+'</p></div></div>'+
        '<p class="ts ct" style="text-align:'+ta()+';margin-bottom:12px">'+(y.explanation||'')+'</p>'+
        '<div class="trust-row">'+
        '<span class="trust-badge">'+iconCirc('bank',13)+l.alinmaBadge+'</span>'+
        '<span class="trust-badge">'+iconCirc('shield',13)+l.shariahBadge+'</span></div>';
      if(!setHtml('yieldResult',aiCardShell('yield',inner,false)))return;
      addActivity(c.id,'yield',T.ar.actYield,T.en.actYield);
    });
  });

  // Drag-to-reorder turn order
  bindSortable('sortableList',c.id);

  // Turn Agent — AI-suggested fair payout order from salary date + financial goal
  on('bsuggestOrder','click',function(){
    el('turnAiResult').innerHTML=skeletonHtml(3);
    var payload={event_type:'assign_turns',members:c.members.map(function(m){
      return {name:isA()?m.ar:m.en,salary_date:m.salaryDate||27,financial_goal:m.goal||(isA()?'ادخار مستقر، لا حاجة عاجلة':'stable savings, no urgent need')};
    })};
    callAgent(payload,function(result,err){
      if(err){console.error('Turn Agent error:',err);setHtml('turnAiResult',aiCardShell('turn','<p class="ts cr" style="display:flex;align-items:center;gap:6px">'+icon('alert',15)+' '+l.aiServiceDown+'</p>',false));return;}
      var order=(result&&result.result&&result.result.turn_order)||[];
      var reasonsHtml='';
      order.forEach(function(o,i){
        reasonsHtml+='<div style="padding:8px 0;border-bottom:1px solid var(--border)"><p class="ts b7 ct">'+(i+1)+'. '+o.name+'</p><p class="tx cm" style="margin-top:2px">'+(o.reason||'')+'</p></div>';
      });
      var inner='<p class="slbl" style="margin:0 0 6px;text-align:'+ta()+'">'+l.turnReasonsTitle+'</p>'+reasonsHtml+
        '<button id="applyOrderBtn" class="bo" style="margin-top:14px">'+l.applyOrderBtn+'</button>';
      if(!setHtml('turnAiResult',aiCardShell('turn',inner,false)))return;
      addActivity(c.id,'turn',T.ar.actTurn,T.en.actTurn);
      on('applyOrderBtn','click',function(){
        var orderedIds=[];
        order.forEach(function(o){
          for(var i=0;i<c.members.length;i++){
            if(c.members[i].ar===o.name||c.members[i].en===o.name){orderedIds.push(c.members[i].id);break;}
          }
        });
        c.members.forEach(function(m){if(orderedIds.indexOf(m.id)===-1)orderedIds.push(m.id);});
        reorderMembers(c.id,orderedIds);
      });
    });
  });

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
      el('dbaAi').style.display='inline-flex';
      if(_detailRisk){
        var r=_detailRisk,isR=r.level==='red';
        el('dra').innerHTML='<div class="rsk '+(isR?'rsk-rd':'rsk-yl')+'"><div style="color:'+(isR?'var(--red)':'var(--yellow)')+';flex-shrink:0">'+icon('alert',22)+'</div><div style="flex:1"><p class="tm b8" style="margin-bottom:4px;color:'+(isR?'var(--red)':'var(--yellow)')+'">'+(isR?l.riskRedTitle:l.riskYellowTitle)+'</p><p class="ts ct" style="margin-bottom:6px"><strong>'+(isA()?r.ar:r.en)+'</strong> — '+(isA()?r.rAr:r.rEn)+'</p><p class="tx cm">'+l.riskHistory+': '+(isA()?r.hAr:r.hEn)+'</p></div></div>';
        el('dba').textContent=l.addAnywayBtn;el('dba').className=isR?'bd':'bo';
      } else {el('dra').innerHTML='';el('dba').textContent=l.addBtn;el('dba').className='bo';}
    } else {_detailRisk=null;el('dra').innerHTML='';el('dba').textContent=l.addBtn;el('dba').className='bo';el('dbaAi').style.display='none';}
  });
  on('dbaAi','click',function(){runRiskAgentCheck(el('dmn').value.trim(),el('dmp').value.trim(),_detailRisk,'draAi',c.id)});
  on('dba','click',function(){
    var n=el('dmn').value.trim(),p=el('dmp').value.trim();
    if(!n||p.length<9){el('de2').textContent=l.errFillAll;el('de2').style.display='block';return;}
    addMemberToCircle(c.id,{ar:n,en:n,phone:p,risk:_detailRisk?_detailRisk.level:null});
  });

  // Start button
  on('bstart','click',function(){setState({contractView:'preview'})});

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
    sessionStorage.setItem(DB_KEY,JSON.stringify(list));
    deleteCircleFromServer(c.id);
    addNotification(T.ar.circleDeletedNotif(c.ar),T.en.circleDeletedNotif(c.en));
    setState({activeCircleId:null});
  });
}

// ── Pay screen ────────────────────────────────────────────
var _payMethod='mada';
function scrPay(c){
  var l=tt(),nm=isA()?c.ar:c.en,me=myMember(c),pot=c.amount*c.totalTurns;
  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbkpay">'+icon('back',15,'ic-back')+l.backBtn+'</button>'+
    '<p class="htop" style="text-align:'+ta()+'">'+nm+'</p>'+
    '<h1 style="text-align:'+ta()+'">'+l.payScreenTitle+'</h1></div><div class="body">'+
    '<div class="cd" style="text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.amountDueLabel+'</p>'+
    '<p class="t3 b9 cp" dir="ltr">'+c.amount+' '+l.sarUnit+'</p></div>'+
    '<div class="twoc"><div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.queuePosLabel+'</p><p class="tl b8 ct" dir="ltr">'+(me?me.turn:'—')+' / '+c.totalTurns+'</p></div>'+
    '<div class="cd" style="margin-bottom:0;text-align:center"><p class="tx cm" style="margin-bottom:6px">'+l.totalPotLabel+'</p><p class="tl b8 ct" dir="ltr">'+pot+' '+l.sarUnit+'</p></div></div>'+
    '<div class="cd"><p class="st">'+l.paymentMethodLabel+'</p>'+
    '<div class="ltg"><button id="pmMada" class="ltb'+(_payMethod==='mada'?' on':'')+'">'+icon('card',15)+' '+l.methodMada+'</button>'+
    '<button id="pmApple" class="ltb'+(_payMethod==='apple'?' on':'')+'">'+icon('card',15)+' '+l.methodApplePay+'</button></div></div>'+
    '<button id="bconfirmPay" class="bstart">'+l.confirmPayBtn+' · '+c.amount+' '+l.sarUnit+'</button>'+
    '</div></div>';

  on('bbkpay','click',function(){setState({payMode:'off'})});
  on('pmMada','click',function(){_payMethod='mada';setState({})});
  on('pmApple','click',function(){_payMethod='apple';setState({})});
  on('bconfirmPay','click',function(){payNow(c.id);setState({payMode:'success'})});
}

function scrPaySuccess(c){
  var l=tt(),now=new Date();
  $app.innerHTML='<div class="cen"><div class="suc">✓</div>'+
    '<h2 class="t2 b9 ct tc" style="margin-bottom:10px">'+l.paySuccessTitle+'</h2>'+
    '<p class="tb cm tc" style="margin-bottom:24px">'+l.paySuccessSub+'</p>'+
    '<div class="brk" style="width:100%;margin-bottom:32px">'+
    '<div class="brk-row"><span>'+l.receiptDateLabel+'</span><span>'+fmtDateObj(now)+'</span></div>'+
    '<div class="brk-row"><span>'+l.receiptMethodLabel+'</span><span>'+(_payMethod==='mada'?l.methodMada:l.methodApplePay)+'</span></div>'+
    '<div class="brk-row"><span>'+l.amountDueLabel+'</span><span dir="ltr">'+c.amount+' '+l.sarUnit+'</span></div></div>'+
    '<button id="bbackcircle" class="bp">'+l.backToCircle+'</button></div>';
  on('bbackcircle','click',function(){setState({payMode:'off'})});
}

function payNow(circleId){
  // Atomic per-member update, not updateCircle's full-blob push -- another
  // member could be paying/responding to the same circle at the same time.
  var list=getCircles(),c=null;
  for(var i=0;i<list.length;i++){if(list[i].id===circleId){c=list[i];break;}}
  if(!c)return;
  var me=myMember(c);if(!me)return;
  me.paid=true;
  sessionStorage.setItem(DB_KEY,JSON.stringify(list));
  updateMyMemberOnServer(circleId,{paid:true});
}

// ── Digital contract (circle start) ─────────────────────────
function scrContract(c){
  var l=tt(),nm=isA()?c.ar:c.en,sorted=c.members.slice().sort(function(a,b){return a.turn-b.turn});
  var orderNames=sorted.map(function(m){return isA()?m.ar:m.en}).join(isA()?'، ':', ');
  $app.innerHTML='<div class="has-nav"><div class="hdr"><button class="bbk" id="bbkc">'+icon('back',15,'ic-back')+l.backBtn+'</button>'+
    '<p class="htop" style="text-align:'+ta()+'">'+nm+'</p>'+
    '<h1 style="text-align:'+ta()+'">'+l.contractTitle+'</h1></div><div class="body">'+
    '<p class="ts cm" style="margin-bottom:16px;text-align:'+ta()+'">'+l.contractDesc+'</p>'+
    '<div class="contract-card">'+
    '<div class="contract-row"><span class="cm">'+l.contractMembers+'</span><span class="b7 ct">'+c.members.length+'</span></div>'+
    '<div class="contract-row"><span class="cm">'+l.contractAmount+'</span><span class="b7 ct" dir="ltr">'+c.amount+' '+l.sarUnit+'</span></div>'+
    '<div class="contract-row"><span class="cm">'+l.contractOrder+'</span><span class="b7 ct" style="max-width:60%;text-align:'+ta()+'">'+orderNames+'</span></div>'+
    '<div class="contract-row"><span class="cm">'+l.contractPolicy+'</span><span class="b7 ct" style="max-width:60%;text-align:'+ta()+'">'+l.contractPolicyVal+'</span></div>'+
    '</div>'+
    '<button id="bsign" class="bstart f row g8 ac jc" style="margin-top:20px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('lock',16)+l.signContractBtn+'</button>'+
    '</div></div>';
  on('bbkc','click',function(){setState({contractView:'off'})});
  on('bsign','click',function(){
    updateCircle(c.id,{status:'active',currentTurn:1});
    setState({contractView:'signed'});
  });
}

function scrContractSigned(c){
  var l=tt();
  $app.innerHTML='<div class="cen"><div class="suc">✓</div>'+
    '<h2 class="t2 b9 ct tc" style="margin-bottom:10px">'+l.circleStartedTitle+'</h2>'+
    '<div class="contract-signed" style="'+(isA()?'flex-direction:row-reverse;':'')+'margin:0 auto 30px">'+icon('lock',15)+l.contractSignedMsg+'</div>'+
    '<button id="bbackc2" class="bp">'+l.backToCircle+'</button></div>';
  on('bbackc2','click',function(){setState({contractView:'off'})});
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
    var rb='';if(m.risk)rb='<span class="bz '+(m.risk==='red'?'bz-rd':'bz-yl')+'">'+icon('alert',11)+'</span>';
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
    '<button id="baAi" class="bg-btn f row g6 ac jc" style="display:none;margin-top:4px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('sparkles',14)+l.askRiskAgent+'</button>'+
    '<button id="btglTurnOpt" class="bg-btn f row g6 ac jc" style="margin-top:4px;'+(isA()?'flex-direction:row-reverse':'')+'">'+icon('sparkles',14)+l.aiOptToggle+'</button>'+
    '<div id="turnOptForm" style="display:none;margin-top:8px;direction:'+(isA()?'rtl':'ltr')+'">'+
    '<div class="fg"><label class="fl">'+l.salaryDateLabel+'</label><input id="msd" type="number" inputmode="numeric" min="1" max="31" dir="ltr" class="fi" placeholder="25" /></div>'+
    '<div class="fg" style="margin-bottom:0"><label class="fl">'+l.financialGoalLabel+'</label><input id="mgoal" type="text" class="fi" placeholder="'+l.goalPH+'" /></div></div>'+
    '<p id="e2" class="ts cr" style="margin-bottom:12px;margin-top:12px;display:none;text-align:'+ta()+'"></p>'+
    '<button id="ba" class="bo" style="margin-top:12px">'+l.addBtn+'</button></div>'+
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
      el('baAi').style.display='inline-flex';
      if(_cr){
        var r=_cr,isR=r.level==='red';
        el('ra').innerHTML='<div class="rsk '+(isR?'rsk-rd':'rsk-yl')+'"><div style="color:'+(isR?'var(--red)':'var(--yellow)')+';flex-shrink:0">'+icon('alert',22)+'</div><div style="flex:1"><p class="tm b8" style="margin-bottom:4px;color:'+(isR?'var(--red)':'var(--yellow)')+'">'+(isR?l.riskRedTitle:l.riskYellowTitle)+'</p><p class="ts ct" style="margin-bottom:6px"><strong>'+(isA()?r.ar:r.en)+'</strong> — '+(isA()?r.rAr:r.rEn)+'</p><p class="tx cm">'+l.riskHistory+': '+(isA()?r.hAr:r.hEn)+'</p></div></div>';
        el('ba').textContent=l.addAnywayBtn;el('ba').className=isR?'bd':'bo';
      } else {el('ra').innerHTML='';el('ba').textContent=l.addBtn;el('ba').className='bo';}
    } else {_cr=null;el('ra').innerHTML='';el('ba').textContent=l.addBtn;el('ba').className='bo';el('baAi').style.display='none';}
  });
  on('baAi','click',function(){runRiskAgentCheck(el('mn').value.trim(),el('mp').value.trim(),_cr,'raAi')});
  on('btglTurnOpt','click',function(){var f=el('turnOptForm');f.style.display=f.style.display==='none'?'block':'none';});
  on('ba','click',function(){
    var n=el('mn').value.trim(),p=el('mp').value.trim();
    if(!n||p.length<9){el('e2').textContent=l.errFillAll;el('e2').style.display='block';return;}
    var sd=parseInt(el('msd').value,10),goal=(el('mgoal').value||'').trim();
    _cm.push({name:n,phone:p,risk:_cr?_cr.level:null,salaryDate:sd>=1&&sd<=31?sd:null,goal:goal||null});_cr=null;setState({createStep:2});
  });
  el('ml').addEventListener('click',function(e){var btn=e.target.closest('.rmb');if(!btn)return;_cm.splice(parseInt(btn.dataset.i,10),1);setState({createStep:2})});
  on('bc','click',function(){
    if(_cm.length<2){el('ec').textContent=l.errMinMembers;el('ec').style.display='block';return;}
    // The organizer is a real participant too -- turn 1, auto-confirmed --
    // not just a label, so they're actually in the payout rotation and
    // other logged-in accounts see them as a member, not just an owner.
    var creator={id:0,ar:state.session.name_ar,en:state.session.name_en,
      init:state.session.name_en.slice(0,2).toUpperCase(),phone:state.session.phone,
      turn:1,paid:false,confirmed:'confirmed',risk:null,salaryDate:null,goal:null};
    var members=[creator].concat(_cm.map(function(m,i){return{id:i+1,ar:m.name,en:m.name,init:m.name.slice(0,2).toUpperCase(),phone:m.phone,turn:i+2,paid:false,confirmed:'pending',risk:m.risk||null,salaryDate:m.salaryDate||null,goal:m.goal||null}}));
    saveCircle({ar:_cn,en:_cn,amount:parseInt(_ca,10),totalTurns:members.length,members:members,startDate:_cd});
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
    '<div class="cd"><div class="srow"><div class="f row g10 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="srow-ic">'+icon('card',16)+'</div><p class="tm b6 ct">'+l.notifPayment+'</p></div><button class="tgl'+(s.notifPayment?' on':'')+'" id="tp"></button></div>'+
    '<div class="srow"><div class="f row g10 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="srow-ic">'+icon('users',16)+'</div><p class="tm b6 ct">'+l.notifGroup+'</p></div><button class="tgl'+(s.notifGroup?' on':'')+'" id="tg"></button></div></div>'+
    '<p class="slbl" style="text-align:'+ta()+'">'+l.profileSection+'</p>'+
    '<div class="cd"><div class="srow"><div class="f row g10 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="srow-ic">'+icon('user',16)+'</div><p class="tm b6 ct">'+l.nameLabel+'</p></div>'+
    '<div class="f row g8 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><p id="nameDisplay" class="tb cm b6">'+(state.session?(isA()?state.session.name_ar:state.session.name_en):l.nameVal)+'</p><button id="btglName" class="bg-btn" style="width:auto">'+l.editPriceBtn+'</button></div></div>'+
    '<div id="nameForm" style="display:none;padding:0 0 16px;direction:'+(isA()?'rtl':'ltr')+'">'+
    '<div class="fg" style="margin-bottom:8px"><input id="npName" type="text" class="fi" dir="'+(isA()?'rtl':'ltr')+'" value="'+(state.session?(isA()?state.session.name_ar:state.session.name_en):'')+'" /></div>'+
    '<div class="f row g10"><button id="bsaveName" class="bp" style="flex:1">'+l.savePriceBtn+'</button>'+
    '<button id="bcancelName" class="bg-btn" style="flex:1">'+l.cancelBtn+'</button></div></div>'+
    '<div class="srow"><div class="f row g10 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="srow-ic">'+icon('phone',16)+'</div><p class="tm b6 ct">'+l.phoneLabel2+'</p></div><p class="tb cm b6" dir="ltr">'+(state.session?state.session.phone:'—')+'</p></div>'+
    '<div class="srow"><div class="f row g10 ac" style="'+(isA()?'flex-direction:row-reverse;':'')+'"><div class="srow-ic">'+icon('info',16)+'</div><p class="tm b6 ct">'+l.versionLabel+'</p></div><p class="tb cm">1.0.0</p></div></div>'+
    '<button id="blo" class="bd f row g8 ac jc" style="'+(isA()?'flex-direction:row-reverse;':'')+'margin-top:4px">'+icon('logout',16)+l.logoutBtn+'</button></div></div>';

  on('sla','click',function(){applySet(Object.assign({},state.settings,{lang:'ar'}))});
  on('sle','click',function(){applySet(Object.assign({},state.settings,{lang:'en'}))});
  qa('.szb').forEach(function(btn){btn.addEventListener('click',function(){applySet(Object.assign({},state.settings,{textSize:btn.dataset.sz}))})});
  on('tp','click',function(){applySet(Object.assign({},state.settings,{notifPayment:!state.settings.notifPayment}))});
  on('tg','click',function(){applySet(Object.assign({},state.settings,{notifGroup:!state.settings.notifGroup}))});
  on('btglName','click',function(){
    var f=el('nameForm');
    f.style.display=f.style.display==='none'?'block':'none';
    if(f.style.display==='block'){el('npName').focus();}
  });
  on('bcancelName','click',function(){el('nameForm').style.display='none'});
  on('bsaveName','click',function(){
    var val=(el('npName').value||'').trim();
    if(!val||!state.session)return;
    state.session.name_ar=val;
    state.session.name_en=val;
    saveSession(state.session);
    el('nameForm').style.display='none';
    setState({});
  });
  on('blo','click',function(){
    clearSession();
    state.session=null;
    setState({phase:'language',tab:'circles',activeCircleId:null});
  });
}
function applySet(s){saveSettings(s);setState({settings:s})}

// ═══════════════════════════════════════════════════════════
// 7. NAV
// ═══════════════════════════════════════════════════════════
function renderNav(){
  if(state.phase!=='app'){$nav.className='';return;}
  $nav.className='show';
  var l=tt(),tabs=[{id:'circles',icon:'home',label:l.navCircles},{id:'create',icon:'plus',label:l.navCreate},{id:'settings',icon:'settings',label:l.navSettings}];
  var h='';tabs.forEach(function(tb){h+='<button class="ni'+(state.tab===tb.id?' on':'')+'" data-t="'+tb.id+'"><span class="ni-i">'+icon(tb.icon,22)+'</span><span class="ni-l">'+tb.label+'</span><span class="ni-d"></span></button>'});
  $nav.innerHTML=h;
  qa('.ni').forEach(function(btn){btn.addEventListener('click',function(){
    var tgt=btn.dataset.t;
    var upd={tab:tgt,activeCircleId:null,createStep:1,notifView:false,payMode:'off',contractView:'off'};
    if(tgt==='circles'){syncCirclesFromServer(function(){setState(upd)});}
    else{setState(upd);}
  })});
}

// ═══════════════════════════════════════════════════════════
// 8. ROUTER
// ═══════════════════════════════════════════════════════════
function render(){
  document.documentElement.lang=state.lang;
  document.documentElement.dir=state.lang==='ar'?'rtl':'ltr';
  applyScale();
  if(state.phase==='language')scrLanguage();
  else if(state.phase==='login')scrLogin();
  else if(state.phase==='signup')scrSignup();
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
dbInit();
if(state.session){syncCirclesFromServer(render);}else{render();}
})();
