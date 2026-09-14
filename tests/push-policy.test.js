import assert from 'node:assert/strict';
import {
  buildDeliveryTargets,
  messageForTarget,
  validUuid,
  validVapidSubject,
} from '../api/push/push-policy.js';

assert.equal(validVapidSubject('mailto:admin@example.com'), true);
assert.equal(validVapidSubject('https://example.com/push-contact'), true);
assert.equal(validVapidSubject('admin@example.com'), false);
assert.equal(validVapidSubject(''), false);

assert.equal(validUuid('123e4567-e89b-12d3-a456-426614174000'), true);
assert.equal(validUuid('not-a-uuid'), false);

const createTargets = buildDeliveryTargets({
  change_type: 'create',
  grade: 1,
  class_number: 2,
  period: 5,
  before_data: null,
  after_data: {
    grade: 1,
    class_number: 2,
    period: 5,
    activity: '축구',
    location: '운동장',
  },
});
assert.deepEqual(createTargets, [{
  grade: 1,
  classNo: 2,
  period: 5,
  activity: '축구',
  location: '운동장',
  kind: 'current',
}]);

const deleteTargets = buildDeliveryTargets({
  change_type: 'delete',
  grade: 2,
  class_number: 3,
  period: 4,
  before_data: {
    grade: 2,
    class_number: 3,
    period: 4,
    activity: '농구',
    location: '체육관',
  },
  after_data: null,
});
assert.equal(deleteTargets.length, 1);
assert.equal(deleteTargets[0].kind, 'deleted');
assert.equal(deleteTargets[0].classNo, 3);

const sameClassUpdate = buildDeliveryTargets({
  change_type: 'update',
  before_data: {
    grade: 1,
    class_number: 2,
    period: 5,
    activity: '축구',
    location: '운동장',
  },
  after_data: {
    grade: 1,
    class_number: 2,
    period: 5,
    activity: '배드민턴',
    location: '체육관',
  },
});
assert.equal(sameClassUpdate.length, 1);
assert.equal(sameClassUpdate[0].kind, 'current');
assert.equal(sameClassUpdate[0].activity, '배드민턴');

const movedClassUpdate = buildDeliveryTargets({
  change_type: 'update',
  before_data: {
    grade: 1,
    class_number: 2,
    period: 5,
    activity: '축구',
    location: '운동장',
  },
  after_data: {
    grade: 1,
    class_number: 3,
    period: 5,
    activity: '축구',
    location: '운동장',
  },
});
assert.equal(movedClassUpdate.length, 2);
assert.deepEqual(movedClassUpdate.map((target) => [target.classNo, target.kind]), [
  [3, 'current'],
  [2, 'previous'],
]);

const currentMessage = messageForTarget('update', movedClassUpdate[0]);
assert.equal(currentMessage.title, '체육 안내가 변경됐어요');
assert.match(currentMessage.body, /1-3/);
assert.match(currentMessage.body, /축구/);

const previousMessage = messageForTarget('update', movedClassUpdate[1]);
assert.equal(previousMessage.title, '체육 안내가 변경됐어요');
assert.match(previousMessage.body, /1-2/);
assert.match(previousMessage.body, /기존 체육 안내가 다른 반 정보로 변경/);

console.log('OK: push delivery policy');
