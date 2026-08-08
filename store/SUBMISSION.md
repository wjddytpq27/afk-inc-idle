# AFK 주식회사 — 포털 제출 패키지

라이브: https://idle-peach-phi.vercel.app
GitHub: https://github.com/wjddytpq27/afk-inc-idle

이 폴더(`store/`)에 제출에 필요한 모든 자산이 준비돼 있습니다.

## 1. CrazyGames 제출 (1순위 — 광고 수익 쉐어)

### 준비된 자산
| 항목 | 파일 | 규격 |
|------|------|------|
| 게임 빌드 | `afk-inc-crazygames.zip` | index.html 루트, 상대경로, SDK 통합 완료 |
| 커버(가로) | `cover-landscape-1920x1080.png` | 16:9 |
| 커버(세로) | `cover-portrait-800x1200.png` | 2:3 |
| 커버(정사각) | `cover-square-800x800.png` | 1:1 |
| 스크린샷 | `screenshot-1~3-*.png` | 게임플레이 |

### 제출 메타데이터 (복붙용)

- **Title**: AFK 주식회사 (AFK Inc.)
- **Category**: Idle / Clicker
- **Tags**: idle, clicker, incremental, tycoon, money, management, ai, prestige, casual
- **Orientation**: Portrait (모바일 세로) + 데스크톱 지원
- **Controls / Instructions (EN)**:
  > Tap the money bag to earn cash. Hire bots that earn for you automatically,
  > even while you're away (offline earnings up to 8h). Buy more of each bot to
  > hit ×2 milestone multipliers, unlock auto-buy, and prestige into the
  > singularity for a permanent income boost. Watch a short ad for a 60-second
  > ×2 boost or to double your offline earnings.
- **Controls / Instructions (KO)**:
  > 돈 자루를 탭해서 돈을 버세요. 봇을 고용하면 자리를 비운 사이에도(최대 8시간)
  > 자동으로 벌어줍니다. 같은 봇을 많이 사서 ×2 마일스톤 배수를 달성하고,
  > 자동 구매를 해금하고, 특이점 리셋으로 영구 수익을 올리세요. 광고를 보면
  > 60초 ×2 부스터 또는 오프라인 수익 2배를 받을 수 있어요.
- **Short description (EN)**:
  > Hire AI bots and let them build your money empire while you're AFK. A cozy
  > idle tycoon: tap, automate, prestige, repeat — from a street stall to a
  > spacefaring corporation.
- **Long description (EN)**:
  > AFK Inc. is a relaxing idle/incremental game about getting rich while doing
  > nothing. Hire your first worker, then scale up through bots, scrapers,
  > trading algorithms, content factories, data centers and beyond. Every bot
  > earns passively — even offline — and hitting milestone counts doubles their
  > output. Unlock auto-buy to automate the grind, then prestige into the
  > "singularity" for a permanent multiplier. Your headquarters visibly evolves
  > from a street stall to a neon megacity to a spacefaring empire as your net
  > worth grows. Optional rewarded ads give a 60-second double-income boost and
  > double your offline earnings. No install, no waiting — just satisfying number-go-up.

### SDK — 이미 통합 완료
CrazyGames HTML5 SDK v3가 `index.html`에 삽입돼 있고 다음이 연결됨:
- **리워드 광고**: 60초 ×2 부스터 버튼, 오프라인 수익 2배 버튼
- **미드게임 광고**: 특이점 리셋 시
CrazyGames 도메인에 올라가면 자동으로 실제 광고가 나오고, 그 외 도메인에선
보상을 즉시 지급하는 폴백으로 작동(어드블록 대응 요건 충족).

### 사람이 해야 하는 단계 (계정·수익)
1. https://developer.crazygames.com 에서 개발자 계정 생성 (Google 로그인 가능)
2. "Add a new game" → `afk-inc-crazygames.zip` 업로드
3. 위 메타데이터 붙여넣기 + 커버 3종 + 스크린샷 업로드
4. QA 자동검사 통과 → 리뷰 제출 (수동 리뷰 수일 소요)
5. **수익 지급**: 대시보드 Payments에서 PayPal 또는 은행 등록 (승인 후 월 정산)

## 2. 백업 포털 (CrazyGames 리뷰 지연/반려 시)
- **GameDistribution** / **GameMonetize**: 즉시 셀프서브 등록. 단, SDK가 달라서
  해당 SDK로 재통합 필요(요청 시 브랜치로 작업). 같은 zip 구조 재사용 가능.

## 자산 갱신 방법
게임을 수정하면:
```bash
cd ~/Desktop/돈/idle
# 커버/스크린샷 재생성이 필요하면 스크린샷 스크립트 재실행
zip -j store/afk-inc-crazygames.zip index.html style.css game.js
vercel deploy --prod --yes   # 라이브 갱신
git add -A && git commit -m "..." && git push
```
