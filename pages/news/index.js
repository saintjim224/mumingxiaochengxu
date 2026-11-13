Page({
  data: {
    selectedOfficer: 'mu-xiaoan',
    officers: {
      'mu-xiaoan': {
        name: '牧小安',
        title: '应急防灾首席官',
        avatar: '/images/brand/mu-xiaoan.jpg',
        welcome: '扎西德勒！我是应急防灾首席官牧小安。专注于高寒圈舍加固防风、白灾应急保畜和越冬补饲调配，有什么防灾疑问请随时问我。'
      },
      'mu-xiaorong': {
        name: '牧小融',
        title: '时空气象首席官',
        avatar: '/images/brand/mu-xiaorong.jpg',
        welcome: '扎西德勒！我是时空气象首席官牧小融。实时追踪青藏高原26县极端气象、降温梯度与暴风雪走势，为您提供最精准的放牧天候推演。'
      },
      'mu-xiaoxiang': {
        name: '牧小象',
        title: '遥感生态首席官',
        avatar: '/images/brand/mu-xiaoxiang.jpg',
        welcome: '扎西德勒！我是遥感生态首席官牧小象。通过多源卫星遥感分析高寒草场积雪覆草、冻土深度与植被物候，帮您精准把握草场载畜承载力。'
      }
    },
    quickQuestions: [
      '玛多县今晚有暴雪吗？放牧要注意什么？',
      '积雪达到多少公分必须停止出牧？',
      '塑料暖棚积雪怎么安全清除防压塌？',
      '牛羊出现严重风雪冻伤如何应急处理？'
    ],
    messages: [],
    inputText: ''
  },

  onLoad() {
    this.resetOfficerWelcome();
  },

  selectOfficer(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedOfficer: id });
    this.resetOfficerWelcome();
  },

  resetOfficerWelcome() {
    const current = this.data.officers[this.data.selectedOfficer];
    this.setData({
      messages: [
        {
          id: 1,
          sender: 'ai',
          name: current.name,
          avatar: current.avatar,
          text: current.welcome,
          time: '刚刚'
        }
      ]
    });
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value });
  },

  askQuick(e) {
    const q = e.currentTarget.dataset.q;
    this.sendMessage(q);
  },

  sendInput() {
    if (!this.data.inputText.trim()) return;
    this.sendMessage(this.data.inputText);
    this.setData({ inputText: '' });
  },

  sendMessage(questionText) {
    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: questionText,
      time: '刚刚'
    };

    const newMessages = [...this.data.messages, userMsg];
    this.setData({ messages: newMessages });

    // 智能防灾应答引擎
    setTimeout(() => {
      const reply = this.generateAIReply(questionText, this.data.selectedOfficer);
      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        name: this.data.officers[this.data.selectedOfficer].name,
        avatar: this.data.officers[this.data.selectedOfficer].avatar,
        text: reply,
        time: '刚刚'
      };
      this.setData({
        messages: [...this.data.messages, aiMsg]
      });
    }, 500);
  },

  generateAIReply(q, officer) {
    if (q.includes('玛多') || q.includes('暴雪')) {
      return '【牧小融·气象研判】当前果洛玛多县（海拔4300m）处于强降温与阵雪影响区，夜间气温将降至-18℃以下，阵风6-7级。建议：今日15:30前务必将牛羊全部收拢归圈，夜间关闭暖棚迎风侧通风口，防范风寒效应。';
    } else if (q.includes('公分') || q.includes('停止') || q.includes('出牧')) {
      return '【牧小安·防灾规程】依照 GB/T 20482 牧区雪灾标准：当草场积雪深度超过 10cm 时，羊群觅食困难，应转为半草场半人工补饲；当积雪超过 15cm（中度白灾）以上时，牧草完全受覆，必须 100% 停止放牧，全面转入舍饲保畜。';
    } else if (q.includes('暖棚') || q.includes('清除') || q.includes('压塌')) {
      return '【牧小安·工程加固】高原塑料暖棚积雪清除注意：1. 严禁使用铁锹等锋利工具直接铲膜，可用布条绑紧的软竹竿或长柄推雪板从两侧向中间顺向推雪；2. 优先清理棚脚两侧堆积的硬冰雪，避免侧向挤压骨架变形；3. 内部可临时用立木对主拱架进行加固顶撑。';
    } else if (q.includes('冻伤') || q.includes('自救')) {
      return '【牧区救灾指导】牲畜冻伤应急：1. 严禁直接用火烘烤或用热水浇淋受冻部位！应用柔软干布轻柔擦拭复温；2. 耳尖、蹄部、尾端涂抹防冻凡士林或樟脑软膏；3. 灌服 30℃ 左右温热淡盐水与麦麸汤，补充体能，防止脱水与胃肠痉挛。';
    } else {
      return '【融天综合决策】针对您咨询的问题：“' + q + '”，当前高寒牧区气象台建议您密切关注所在县域积雪与低温黄色预警，遇紧急情况可随时点击拨打下方的乡镇应急救援专线（0896-3822119）。';
    }
  }
});
