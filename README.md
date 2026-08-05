# 피부염 증상 기록

눈 주위, 뒤통수, 목 뒤, 두피에 반복적으로 나타나는 가려움, 붉어짐, 각질, 건조함, 피부 벗겨짐과 생활 패턴을 기록하는 개인용 React 앱입니다. 의료 진단이나 치료를 제공하지 않고, 병원 진료 시 증상 추이를 참고하기 위한 기록 도구입니다.

## 주요 기능

- 오늘 기록: 날짜, 시간, 증상 부위, 증상 점수, 주의 증상, 상처부위 사진, 생활 패턴, 피부/두피 관리, 약 사용, 휴미라 기록, 자유 메모 저장
- 기록 목록: 최신순 정렬, 날짜/부위 필터, 상세 펼쳐보기, 수정, 삭제
- 통계: 최근 7일/30일 기록 수, 평균 점수, 수면/피로/스트레스 평균, 주요 날짜, SVG 추이 그래프, 단순 패턴 문구
- 데이터 관리: JSON 백업 내보내기/가져오기, CSV 내보내기, DELETE 확인 후 전체 삭제
- 저장 방식: Docker 실행 시 SQLite 데이터베이스에 저장하고, 브라우저 localStorage에는 백업 사본 유지

## 기술 구성

- React
- TypeScript strict mode
- Vite
- oxlint
- Vitest + jsdom
- Node.js HTTP API
- SQLite
- Docker Compose named volume
- localStorage 백업
- CSS/SVG 기반 경량 UI와 그래프

## 설치 방법

```powershell
npm.cmd install
```

## 개발 서버 실행 방법

```powershell
npm.cmd run dev
```

개발 서버는 Vite가 안내하는 로컬 주소에서 확인할 수 있습니다.

개발 서버만 실행하면 API 서버가 없으므로 브라우저 localStorage 백업으로 동작합니다. SQLite 저장까지 확인하려면 Docker 실행 방법을 사용하세요.

## Docker 실행 방법

```powershell
docker compose up -d --build
```

브라우저에서 아래 주소로 접속합니다.

```text
http://localhost:8080
```

Tailscale로 접속할 때는 이 PC의 Tailscale IP에 `:8080` 포트를 붙여 엽니다.

```text
http://<tailscale-ip>:8080
```

Docker 데이터는 named volume에 저장됩니다.

```text
dermatitis-tracker-data:/data
```

기본 SQLite 파일 위치는 컨테이너 내부 `/data/dermatitis-tracker.sqlite`입니다.

## 테스트 방법

```powershell
npm.cmd test
```

테스트 대상은 전체 증상 평균 점수 계산, 날짜 범위 필터, 휴미라 다음 예상 투여일 계산, 저장 데이터 구조 검증, 사진 기록 검증, localStorage 저장 및 서버 저장소 이관 흐름입니다.

## lint 방법

```powershell
npm.cmd run lint
```

## build 방법

```powershell
npm.cmd run build
```

성공하면 `dist/` 폴더에 production build 결과가 생성됩니다.

## 저장 안내

Docker 실행 환경에서는 입력한 데이터가 SQLite 데이터베이스에 저장됩니다. 브라우저 localStorage에는 백업 사본이 남아 서버가 잠시 unavailable 상태여도 최근 기록을 볼 수 있습니다.

SQLite가 처음 비어 있고 브라우저에 기존 localStorage 기록이 있으면 앱이 최초 접속 시 서버 저장소로 자동 이관합니다.

상처부위 사진은 브라우저에서 자동 리사이즈한 뒤 기록과 함께 저장됩니다. 사진이 포함된 JSON 백업 파일은 크기가 커질 수 있습니다.

## JSON 백업 및 복원 방법

데이터 관리 화면에서 전체 데이터를 JSON 파일로 내보낼 수 있습니다. 복원할 때는 JSON 파일 구조를 먼저 검증하며, 잘못된 파일이면 기존 데이터를 변경하지 않고 오류를 표시합니다.

## CSV 내보내기

데이터 관리 화면에서 전체 기록을 CSV 파일로 내보낼 수 있습니다. 병원 진료 전 요약 확인이나 스프레드시트 확인 용도로 사용할 수 있습니다.

CSV에는 사진 원본 데이터가 들어가지 않고 사진 개수와 사진 메모 요약만 포함됩니다. 사진 원본까지 보관하려면 JSON 백업을 사용하세요.

## Docker 볼륨 백업 예시

실행 중인 컨테이너의 `/data` 폴더를 압축 파일로 백업할 수 있습니다.

```powershell
docker run --rm -v dermatitis-tracker-data:/data -v ${PWD}:/backup alpine tar czf /backup/dermatitis-tracker-data.tar.gz -C /data .
```

복원은 기존 볼륨 내용을 교체하는 작업이므로, 실행 중인 컨테이너를 중지하고 현재 데이터를 별도로 보관한 뒤 진행하세요.

## 의료 관련 주의사항

이 앱은 개인 증상 기록을 위한 도구이며 의학적 진단이나 치료를 제공하지 않습니다. 약은 처방받은 방법에 따라 사용하고, 증상이 악화되거나 눈 통증, 시야 변화, 진물, 고름, 발열 등이 나타나면 의료진에게 문의하세요.

## 제외된 기능

- 로그인 및 계정 동기화
- 알림 기능
- 약 사용량, 사용 횟수, 사용 주기 추천
- 의료적 원인 판정 또는 응급 여부 판단
